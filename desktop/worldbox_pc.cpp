#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef UNICODE
#define UNICODE
#endif
#ifndef _UNICODE
#define _UNICODE
#endif
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <shellapi.h>
#else
#include <arpa/inet.h>
#include <netinet/in.h>
#include <signal.h>
#include <sys/socket.h>
#include <unistd.h>
#endif

#include <algorithm>
#include <atomic>
#include <chrono>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <mutex>
#include <sstream>
#include <string>
#include <thread>
#include <vector>

#include "generated_assets.hpp"

namespace fs = std::filesystem;

#ifdef _WIN32
using SocketHandle = SOCKET;
static const SocketHandle INVALID_SOCK = INVALID_SOCKET;
static void closeSocket(SocketHandle s) { closesocket(s); }
#else
using SocketHandle = int;
static const SocketHandle INVALID_SOCK = -1;
static void closeSocket(SocketHandle s) { close(s); }
#endif

static std::atomic<bool> g_running{true};
static std::atomic<bool> g_clientEverConnected{false};
static std::atomic<int64_t> g_lastClientSeenMs{0};
static SocketHandle g_listenSock = INVALID_SOCK;
static std::mutex g_fsMutex;

static void shutdownListenSocket() {
  SocketHandle s = g_listenSock;
  g_listenSock = INVALID_SOCK;
  if (s != INVALID_SOCK) {
#ifdef _WIN32
    shutdown(s, SD_BOTH);
#else
    shutdown(s, SHUT_RDWR);
#endif
    closeSocket(s);
  }
}

static fs::path g_savesDir;
static fs::path g_screenshotsDir;
static fs::path g_runtimeProfileDir;

static int64_t nowMillis() {
  using namespace std::chrono;
  return duration_cast<milliseconds>(steady_clock::now().time_since_epoch()).count();
}

static std::string pathToUtf8(const fs::path& p) {
  auto u8 = p.u8string();
  return std::string(reinterpret_cast<const char*>(u8.data()), u8.size());
}

static std::string jsonEscape(const std::string& s) {
  std::string out;
  out.reserve(s.size() + 16);
  for (unsigned char c : s) {
    switch (c) {
      case '"': out += "\\\""; break;
      case '\\': out += "\\\\"; break;
      case '\b': out += "\\b"; break;
      case '\f': out += "\\f"; break;
      case '\n': out += "\\n"; break;
      case '\r': out += "\\r"; break;
      case '\t': out += "\\t"; break;
      default:
        if (c < 0x20) {
          char buf[8];
          snprintf(buf, sizeof(buf), "\\u%04x", static_cast<unsigned int>(c));
          out += buf;
        } else {
          out.push_back(static_cast<char>(c));
        }
    }
  }
  return out;
}

static std::string sanitizeFilenameStem(const std::string& raw) {
  std::string out;
  for (char c : raw) {
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') ||
        (c >= '0' && c <= '9') || c == '-' || c == '_' || c == '.') {
      out.push_back(c);
    }
  }
  while (!out.empty() && out.front() == '.') out.erase(out.begin());
  if (out.empty()) out = "slot_default";
  if (out.size() > 80) out.resize(80);
  return out;
}

static std::string urlDecode(const std::string& src) {
  std::string out;
  out.reserve(src.size());
  for (size_t i = 0; i < src.size(); ++i) {
    if (src[i] == '%' && i + 2 < src.size()) {
      int hi = std::isdigit(static_cast<unsigned char>(src[i + 1]))
                   ? src[i + 1] - '0'
                   : std::tolower(static_cast<unsigned char>(src[i + 1])) - 'a' + 10;
      int lo = std::isdigit(static_cast<unsigned char>(src[i + 2]))
                   ? src[i + 2] - '0'
                   : std::tolower(static_cast<unsigned char>(src[i + 2])) - 'a' + 10;
      out.push_back(static_cast<char>((hi << 4) | lo));
      i += 2;
    } else if (src[i] == '+') {
      out.push_back(' ');
    } else {
      out.push_back(src[i]);
    }
  }
  return out;
}

static std::string getQueryParam(const std::string& query, const std::string& key) {
  size_t pos = 0;
  while (pos < query.size()) {
    size_t amp = query.find('&', pos);
    std::string pair = query.substr(pos, amp == std::string::npos ? std::string::npos : amp - pos);
    size_t eq = pair.find('=');
    if (eq != std::string::npos && pair.substr(0, eq) == key) {
      return urlDecode(pair.substr(eq + 1));
    }
    if (amp == std::string::npos) break;
    pos = amp + 1;
  }
  return "";
}

static std::vector<uint8_t> decodeBase64(const std::string& in) {
  static int T[256];
  static bool initialized = false;
  if (!initialized) {
    std::fill(std::begin(T), std::end(T), -1);
    const char* chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (int i = 0; i < 64; ++i) T[static_cast<unsigned char>(chars[i])] = i;
    initialized = true;
  }
  std::vector<uint8_t> out;
  out.reserve((in.size() * 3) / 4);
  int val = 0, valb = -8;
  for (unsigned char c : in) {
    if (T[c] == -1) {
      if (c == '=') break;
      continue;
    }
    val = (val << 6) + T[c];
    valb += 6;
    if (valb >= 0) {
      out.push_back(static_cast<uint8_t>((val >> valb) & 0xFF));
      valb -= 8;
    }
  }
  return out;
}

static void initDataDirectories() {
#ifdef _WIN32
  wchar_t appData[MAX_PATH * 2] = {0};
  wchar_t localAppData[MAX_PATH * 2] = {0};
  wchar_t userProfile[MAX_PATH * 2] = {0};
  GetEnvironmentVariableW(L"APPDATA", appData, MAX_PATH * 2);
  GetEnvironmentVariableW(L"LOCALAPPDATA", localAppData, MAX_PATH * 2);
  GetEnvironmentVariableW(L"USERPROFILE", userProfile, MAX_PATH * 2);

  fs::path baseRoaming = wcslen(appData) > 0 ? fs::path(appData) : fs::current_path();
  fs::path baseLocal = wcslen(localAppData) > 0 ? fs::path(localAppData) : baseRoaming;
  fs::path baseUser = wcslen(userProfile) > 0 ? fs::path(userProfile) : baseRoaming;

  g_savesDir = baseRoaming / L"WorldBoxSandbox" / L"saves";
  g_runtimeProfileDir = baseLocal / L"WorldBoxSandbox" / L"runtime";
  g_screenshotsDir = baseUser / L"Pictures" / L"WorldBoxSandbox";
#else
  const char* home = std::getenv("HOME");
  fs::path baseHome = (home && *home) ? fs::path(home) : fs::temp_directory_path();
  const char* customDir = std::getenv("WORLDBOX_PC_DATA_DIR");
  if (customDir && *customDir) {
    fs::path root(customDir);
    g_savesDir = root / "saves";
    g_runtimeProfileDir = root / "runtime";
    g_screenshotsDir = root / "screenshots";
  } else {
    g_savesDir = baseHome / ".local" / "share" / "WorldBoxSandbox" / "saves";
    g_runtimeProfileDir = baseHome / ".cache" / "WorldBoxSandbox" / "runtime";
    g_screenshotsDir = baseHome / "Pictures" / "WorldBoxSandbox";
  }
#endif
  std::error_code ec;
  fs::create_directories(g_savesDir, ec);
  fs::create_directories(g_runtimeProfileDir, ec);
  fs::create_directories(g_screenshotsDir, ec);
}

static bool sendAll(SocketHandle sock, const uint8_t* buf, size_t len) {
  size_t sentTotal = 0;
  while (sentTotal < len) {
    int chunk = static_cast<int>(std::min<size_t>(len - sentTotal, 65536));
#ifdef MSG_NOSIGNAL
    int n = send(sock, reinterpret_cast<const char*>(buf + sentTotal), chunk, MSG_NOSIGNAL);
#else
    int n = send(sock, reinterpret_cast<const char*>(buf + sentTotal), chunk, 0);
#endif
    if (n <= 0) return false;
    sentTotal += static_cast<size_t>(n);
  }
  return true;
}

static void sendHttpResponse(
    SocketHandle sock,
    int status,
    const char* statusText,
    const char* mime,
    const uint8_t* body,
    size_t bodyLen,
    bool cacheImmutable = false) {
  std::ostringstream hdr;
  hdr << "HTTP/1.1 " << status << " " << statusText << "\r\n"
      << "Content-Type: " << mime << "\r\n"
      << "Content-Length: " << bodyLen << "\r\n"
      << "Connection: close\r\n"
      << "Cache-Control: " << (cacheImmutable ? "public, max-age=31536000" : "no-store") << "\r\n\r\n";
  std::string h = hdr.str();
  if (sendAll(sock, reinterpret_cast<const uint8_t*>(h.data()), h.size()) && bodyLen > 0) {
    sendAll(sock, body, bodyLen);
  }
}

static void sendJson(SocketHandle sock, int status, const std::string& json) {
  sendHttpResponse(
      sock,
      status,
      status == 200 ? "OK" : "Error",
      "application/json; charset=utf-8",
      reinterpret_cast<const uint8_t*>(json.data()),
      json.size(),
      false);
}

static void openNativeFolder(const fs::path& folder) {
#ifdef _WIN32
  std::wstring w = folder.wstring();
  ShellExecuteW(nullptr, L"open", w.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
#else
  std::string cmd = "xdg-open \"" + pathToUtf8(folder) + "\" >/dev/null 2>&1 &";
  int rc = std::system(cmd.c_str());
  (void)rc;
#endif
}

static void handleClient(SocketHandle client) {
  std::string req;
  req.reserve(8192);
  char buf[8192];
  size_t headerEnd = std::string::npos;
  size_t contentLength = 0;
  const size_t MAX_BODY = 32u * 1024u * 1024u;

  while (headerEnd == std::string::npos && req.size() < 65536) {
    int n = recv(client, buf, sizeof(buf), 0);
    if (n <= 0) {
      closeSocket(client);
      return;
    }
    req.append(buf, static_cast<size_t>(n));
    headerEnd = req.find("\r\n\r\n");
  }
  if (headerEnd == std::string::npos) {
    closeSocket(client);
    return;
  }

  std::string headersPart = req.substr(0, headerEnd);
  std::istringstream iss(headersPart);
  std::string method, fullTarget, httpVer;
  iss >> method >> fullTarget >> httpVer;

  std::string line;
  std::getline(iss, line);
  while (std::getline(iss, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();
    size_t colon = line.find(':');
    if (colon != std::string::npos) {
      std::string k = line.substr(0, colon);
      std::transform(k.begin(), k.end(), k.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
      if (k == "content-length") {
        contentLength = static_cast<size_t>(std::strtoull(line.c_str() + colon + 1, nullptr, 10));
      }
    }
  }

  if (contentLength > MAX_BODY) {
    sendJson(client, 413, "{\"error\":\"payload_too_large\"}");
    closeSocket(client);
    return;
  }

  size_t bodyStart = headerEnd + 4;
  while (req.size() < bodyStart + contentLength) {
    int n = recv(client, buf, sizeof(buf), 0);
    if (n <= 0) break;
    req.append(buf, static_cast<size_t>(n));
  }
  std::string body = req.substr(bodyStart, contentLength);

  std::string pathOnly = fullTarget;
  std::string query;
  size_t qPos = fullTarget.find('?');
  if (qPos != std::string::npos) {
    pathOnly = fullTarget.substr(0, qPos);
    query = fullTarget.substr(qPos + 1);
  }
  pathOnly = urlDecode(pathOnly);

  g_clientEverConnected.store(true);
  g_lastClientSeenMs.store(nowMillis());

  // ── Native PC RPC API ────────────────────────────────────────────────────
  if (pathOnly == "/__pc/status" && method == "GET") {
    std::string plat =
#ifdef _WIN32
        "win32";
#else
        "linux";
#endif
    std::string out = "{\"nativePc\":true,\"platform\":\"" + plat +
                      "\",\"savesDir\":\"" + jsonEscape(pathToUtf8(g_savesDir)) +
                      "\",\"screenshotsDir\":\"" + jsonEscape(pathToUtf8(g_screenshotsDir)) + "\"}";
    sendJson(client, 200, out);
    closeSocket(client);
    return;
  }

  if (pathOnly == "/__pc/heartbeat") {
    sendJson(client, 200, "{\"ok\":true}");
    closeSocket(client);
    return;
  }

  if (pathOnly == "/__pc/saves" && method == "GET") {
    std::lock_guard<std::mutex> lock(g_fsMutex);
    std::ostringstream arr;
    arr << "{\"saves\":[";
    bool first = true;
    std::error_code ec;
    for (const auto& entry : fs::directory_iterator(g_savesDir, ec)) {
      if (!entry.is_regular_file()) continue;
      if (entry.path().extension() != ".json") continue;
      std::ifstream f(entry.path(), std::ios::binary);
      if (!f) continue;
      std::string content((std::istreambuf_iterator<char>(f)), std::istreambuf_iterator<char>());
      if (content.empty()) continue;
      if (!first) arr << ",";
      first = false;
      arr << "\"" << jsonEscape(content) << "\"";
    }
    arr << "]}";
    sendJson(client, 200, arr.str());
    closeSocket(client);
    return;
  }

  if (pathOnly == "/__pc/save" && method == "POST") {
    std::lock_guard<std::mutex> lock(g_fsMutex);
    std::string id = sanitizeFilenameStem(getQueryParam(query, "id"));
    fs::path target = g_savesDir / (id + ".json");
    std::ofstream f(target, std::ios::binary | std::ios::trunc);
    if (!f) {
      sendJson(client, 500, "{\"ok\":false}");
    } else {
      f.write(body.data(), static_cast<std::streamsize>(body.size()));
      f.flush();
      sendJson(client, 200, "{\"ok\":true,\"path\":\"" + jsonEscape(pathToUtf8(target)) + "\"}");
    }
    closeSocket(client);
    return;
  }

  if (pathOnly == "/__pc/save" && method == "DELETE") {
    std::lock_guard<std::mutex> lock(g_fsMutex);
    std::string id = sanitizeFilenameStem(getQueryParam(query, "id"));
    std::error_code ec;
    fs::remove(g_savesDir / (id + ".json"), ec);
    sendJson(client, 200, "{\"ok\":true}");
    closeSocket(client);
    return;
  }

  if (pathOnly == "/__pc/open-saves-dir" && method == "POST") {
    openNativeFolder(g_savesDir);
    sendJson(client, 200, "{\"ok\":true}");
    closeSocket(client);
    return;
  }

  if (pathOnly == "/__pc/screenshot" && method == "POST") {
    std::lock_guard<std::mutex> lock(g_fsMutex);
    std::string name = sanitizeFilenameStem(getQueryParam(query, "name"));
    if (name.size() < 5 || name.substr(name.size() - 4) != ".png") {
      name += ".png";
    }
    std::vector<uint8_t> png = decodeBase64(body);
    fs::path target = g_screenshotsDir / name;
    std::ofstream f(target, std::ios::binary | std::ios::trunc);
    if (!f || png.empty()) {
      sendJson(client, 500, "{\"ok\":false}");
    } else {
      f.write(reinterpret_cast<const char*>(png.data()), static_cast<std::streamsize>(png.size()));
      f.flush();
      sendJson(client, 200, "{\"ok\":true,\"path\":\"" + jsonEscape(pathToUtf8(target)) + "\"}");
    }
    closeSocket(client);
    return;
  }

  if (pathOnly == "/__pc/quit" && method == "POST") {
    sendJson(client, 200, "{\"ok\":true}");
    closeSocket(client);
    g_running.store(false);
    shutdownListenSocket();
    return;
  }

  // ── Serve Embedded Production Game Assets ────────────────────────────────
  if (pathOnly == "/" || pathOnly.empty()) {
    pathOnly = "/index.html";
  }

  for (size_t i = 0; i < EMBEDDED_ASSETS_COUNT; ++i) {
    if (pathOnly == EMBEDDED_ASSETS[i].path) {
      bool cache = pathOnly != "/index.html";
      sendHttpResponse(
          client,
          200,
          "OK",
          EMBEDDED_ASSETS[i].mime,
          EMBEDDED_ASSETS[i].data,
          EMBEDDED_ASSETS[i].size,
          cache);
      closeSocket(client);
      return;
    }
  }

  const char* msg = "Not Found";
  sendHttpResponse(client, 404, "Not Found", "text/plain", reinterpret_cast<const uint8_t*>(msg), std::strlen(msg), false);
  closeSocket(client);
}

#ifdef _WIN32
static std::wstring queryAppPathRegistry(const wchar_t* exeName) {
  std::wstring subkey = std::wstring(L"SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\") + exeName;
  for (HKEY root : {HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE}) {
    wchar_t value[MAX_PATH * 2] = {0};
    DWORD size = sizeof(value);
    if (RegGetValueW(root, subkey.c_str(), nullptr, RRF_RT_REG_SZ, nullptr, value, &size) == ERROR_SUCCESS) {
      if (fs::exists(fs::path(value))) {
        return std::wstring(value);
      }
    }
  }
  return L"";
}

static HANDLE launchWindowsGameWindow(uint16_t port) {
  std::wstring url = L"http://127.0.0.1:" + std::to_wstring(port) + L"/index.html?pc=1";

  std::vector<fs::path> candidates;
  for (const wchar_t* regExe : {L"msedge.exe", L"chrome.exe", L"brave.exe", L"browser.exe", L"vivaldi.exe"}) {
    std::wstring p = queryAppPathRegistry(regExe);
    if (!p.empty()) candidates.emplace_back(p);
  }

  const wchar_t* envVars[] = {L"ProgramFiles(x86)", L"ProgramFiles", L"LOCALAPPDATA"};
  const wchar_t* relPaths[] = {
      L"Microsoft\\Edge\\Application\\msedge.exe",
      L"Google\\Chrome\\Application\\chrome.exe",
      L"BraveSoftware\\Brave-Browser\\Application\\brave.exe",
      L"Yandex\\YandexBrowser\\Application\\browser.exe",
  };
  for (const wchar_t* ev : envVars) {
    wchar_t buf[MAX_PATH * 2] = {0};
    if (GetEnvironmentVariableW(ev, buf, MAX_PATH * 2) > 0) {
      for (const wchar_t* rel : relPaths) {
        fs::path c = fs::path(buf) / rel;
        if (fs::exists(c)) candidates.push_back(c);
      }
    }
  }

  for (const auto& browserExe : candidates) {
    std::wstring cmd = L"\"" + browserExe.wstring() + L"\" "
                       L"--user-data-dir=\"" + g_runtimeProfileDir.wstring() + L"\" "
                       L"--app=\"" + url + L"\" "
                       L"--window-size=1440,900 "
                       L"--no-first-run --no-default-browser-check "
                       L"--disable-features=TranslateUI "
                       L"--autoplay-policy=no-user-gesture-required";

    STARTUPINFOW si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    std::vector<wchar_t> mutableCmd(cmd.begin(), cmd.end());
    mutableCmd.push_back(L'\0');

    if (CreateProcessW(
            browserExe.wstring().c_str(),
            mutableCmd.data(),
            nullptr,
            nullptr,
            FALSE,
            0,
            nullptr,
            nullptr,
            &si,
            &pi)) {
      CloseHandle(pi.hThread);
      return pi.hProcess;
    }
  }

  ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
  return nullptr;
}
#else
static void launchLinuxGameWindow(uint16_t port) {
  std::string url = "http://127.0.0.1:" + std::to_string(port) + "/index.html?pc=1";
  const char* browsers[] = {
      "google-chrome",
      "chromium",
      "chromium-browser",
      "microsoft-edge",
      "brave-browser",
  };
  for (const char* b : browsers) {
    std::string check = std::string("command -v ") + b + " >/dev/null 2>&1";
    if (std::system(check.c_str()) == 0) {
      std::string cmd = std::string(b) + " --user-data-dir=\"" + pathToUtf8(g_runtimeProfileDir) +
                        "\" --app=\"" + url + "\" --window-size=1440,900 --no-first-run >/dev/null 2>&1 &";
      int rc = std::system(cmd.c_str());
      (void)rc;
      return;
    }
  }
  std::string fallback = "xdg-open \"" + url + "\" >/dev/null 2>&1 &";
  int rc = std::system(fallback.c_str());
  (void)rc;
}
#endif

static int runApp(int argc, char** argv) {
  bool headless = false;
  std::string portFile;
  for (int i = 1; i < argc; ++i) {
    if (std::strcmp(argv[i], "--headless-port-file") == 0 && i + 1 < argc) {
      headless = true;
      portFile = argv[++i];
    }
  }

#ifdef _WIN32
  WSADATA wsa{};
  if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
    return 1;
  }
#else
  signal(SIGPIPE, SIG_IGN);
#endif

  initDataDirectories();

  g_listenSock = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
  if (g_listenSock == INVALID_SOCK) {
    return 1;
  }

  int opt = 1;
  setsockopt(g_listenSock, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));

  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);
  addr.sin_port = htons(0);

  if (bind(g_listenSock, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
    closeSocket(g_listenSock);
    return 1;
  }
  if (listen(g_listenSock, 32) != 0) {
    closeSocket(g_listenSock);
    return 1;
  }

  sockaddr_in bound{};
#ifdef _WIN32
  int boundLen = sizeof(bound);
#else
  socklen_t boundLen = sizeof(bound);
#endif
  getsockname(g_listenSock, reinterpret_cast<sockaddr*>(&bound), &boundLen);
  uint16_t port = ntohs(bound.sin_port);

  std::thread acceptThread([&]() {
    while (g_running.load()) {
      sockaddr_in cliAddr{};
#ifdef _WIN32
      int cliLen = sizeof(cliAddr);
#else
      socklen_t cliLen = sizeof(cliAddr);
#endif
      SocketHandle client = accept(g_listenSock, reinterpret_cast<sockaddr*>(&cliAddr), &cliLen);
      if (client == INVALID_SOCK) {
        if (!g_running.load()) break;
        continue;
      }
      std::thread(handleClient, client).detach();
    }
  });

  if (headless) {
    std::ofstream pf(portFile, std::ios::trunc);
    pf << port << std::endl;
    pf.flush();
    while (g_running.load()) {
      std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
  } else {
#ifdef _WIN32
    HANDLE childProc = launchWindowsGameWindow(port);
    int64_t bootMs = nowMillis();
    while (g_running.load()) {
      if (childProc != nullptr) {
        DWORD waitRes = WaitForSingleObject(childProc, 250);
        if (waitRes == WAIT_OBJECT_0) {
          CloseHandle(childProc);
          childProc = nullptr;
          // Give 3.5s grace in case browser delegated window to an existing helper process;
          // if heartbeats stop arriving, exit cleanly!
        }
      } else {
        std::this_thread::sleep_for(std::chrono::milliseconds(300));
      }

      int64_t elapsed = nowMillis() - bootMs;
      if (g_clientEverConnected.load()) {
        int64_t silentMs = nowMillis() - g_lastClientSeenMs.load();
        if (childProc == nullptr && silentMs > 6500) {
          break;
        }
      } else if (elapsed > 45000) {
        break;
      }
    }
    if (childProc != nullptr) CloseHandle(childProc);
#else
    launchLinuxGameWindow(port);
    int64_t bootMs = nowMillis();
    while (g_running.load()) {
      std::this_thread::sleep_for(std::chrono::milliseconds(400));
      if (g_clientEverConnected.load()) {
        if (nowMillis() - g_lastClientSeenMs.load() > 12000) {
          break;
        }
      } else if (nowMillis() - bootMs > 45000) {
        break;
      }
    }
#endif
  }

  g_running.store(false);
  shutdownListenSocket();
  if (acceptThread.joinable()) {
    acceptThread.join();
  }
#ifdef _WIN32
  WSACleanup();
#endif
  return 0;
}

#ifdef _WIN32
int WINAPI WinMain(HINSTANCE, HINSTANCE, LPSTR, int) {
  return runApp(__argc, __argv);
}
#else
int main(int argc, char** argv) {
  return runApp(argc, argv);
}
#endif
