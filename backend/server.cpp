#define CPPHTTPLIB_DISABLE_MMAP

#include "httplib.h"
#include "json.hpp"

#include <algorithm>
#include <ctime>
#include <fstream>
#include <iostream>
#include <regex>
#include <string>

using json = nlohmann::json;

namespace {

const std::string kUserFile = "users.json";
const int kDefaultBalance = 1000;
const int kDailyTransferLimit = 10000;

class StringUtils {



public:
    // Abstraction: string-related operations are grouped into one helper type
    // so the rest of the code can reuse them without repeating low-level logic.
    static std::string trim(const std::string& value) {
        const auto start = value.find_first_not_of(" \t\r\n");
        if (start == std::string::npos) {
            return "";
        }

        const auto end = value.find_last_not_of(" \t\r\n");
        return value.substr(start, end - start + 1);
    }

    static std::string sanitizeUsername(std::string username) {
        username = trim(username);
        if (!username.empty() && username.find("@upi") == std::string::npos) {
            username += "@upi";
        }
        return username;
    }

    static std::string defaultNameFromUsername(const std::string& username) {
        const auto atPos = username.find('@');
        const std::string base = atPos == std::string::npos ? username : username.substr(0, atPos);
        return base.empty() ? "UPI User" : base;
    }

    static std::string toLower(std::string value) {
        std::transform(value.begin(), value.end(), value.begin(), ::tolower);
        return value;
    }
};




class ResponseBuilder {
public:
    // Abstraction: response creation is centralized here to keep API handlers
    // focused on business logic instead of JSON response formatting.
    static json status(const std::string& statusText, int balance = -1) {
        json response = {{"status", statusText}};
        if (balance >= 0) {
            response["balance"] = balance;
        }
        return response;
    }

    static json dailyLimitExceeded(int spentToday) {
        return {
            {"status", "daily_limit_exceeded"},
            {"daily_spent", spentToday},
            {"daily_limit", kDailyTransferLimit}
        };
    }
};




class TimeUtils {
public:
    // Abstraction: time formatting and time-based checks are encapsulated
    // in a dedicated class to keep date logic separate from wallet logic.
    static std::string nowString() {
        const std::time_t now = std::time(nullptr);
        std::string dateTime = std::ctime(&now);
        if (!dateTime.empty() && dateTime.back() == '\n') {
            dateTime.pop_back();
        }
        return dateTime;
    }

    static bool isTodayHistoryEntry(const std::string& entry) {
        const std::string todayKey = nowString().substr(0, 10);
        return entry.find(todayKey) != std::string::npos;
    }
};





class UserRepository {
public:
    // Encapsulation: all persistence concerns for users are hidden behind this
    // class, so higher layers do not directly manage file I/O details.
    json loadUsers() const {
        std::ifstream file(kUserFile);
        if (!file.is_open()) {
            return json::array();
        }

        json data;
        try {
            file >> data;
        } catch (...) {
            return json::array();
        }

        if (!data.is_array()) {
            return json::array();
        }

        for (auto& user : data) {
            ensureUserShape(user);
        }

        return data;
    }

    void saveUsers(const json& users) const {
        std::ofstream file(kUserFile);
        file << users.dump(4);
    }

    json* findUser(json& users, const std::string& username) const {
        for (auto& user : users) {
            if (user["username"] == username) {
                return &user;
            }
        }
        return nullptr;
    }







private:
    // Encapsulation: this helper is private because shaping raw user data is an
    // internal repository concern, not something outside code should call.
    static void ensureUserShape(json& user) {
        if (!user.contains("username") || !user["username"].is_string()) {
            user["username"] = "";
        }
        if (!user.contains("password") || !user["password"].is_string()) {
            user["password"] = "";
        }
        if (!user.contains("balance") || !user["balance"].is_number_integer()) {
            user["balance"] = kDefaultBalance;
        }
        if (!user.contains("history") || !user["history"].is_array()) {
            user["history"] = json::array();
        }
        if (!user.contains("requests") || !user["requests"].is_array()) {
            user["requests"] = json::array();
        }
        if (!user.contains("name") || !user["name"].is_string() ||
            StringUtils::trim(user["name"].get<std::string>()).empty()) {
            user["name"] = StringUtils::defaultNameFromUsername(user["username"].get<std::string>());
        }
        if (!user.contains("email") || !user["email"].is_string()) {
            user["email"] = "";
        }
        if (!user.contains("phone") || !user["phone"].is_string()) {
            user["phone"] = "";
        }
    }
};




class WalletService {
public:
    // Dependency injection: the service receives a repository object instead of
    // creating one internally, which keeps responsibilities separated.
    explicit WalletService(const UserRepository& repository) : repository_(repository) {}

    json createPublicProfile(const json& user) const {
        return {
            {"username", user["username"]},
            {"name", user["name"]},
            {"email", user["email"]},
            {"phone", user["phone"]},
            {"balance", user["balance"]}
        };
    }

    json signUp(const json& body, int& statusCode) const {
        statusCode = 200;

        const std::string username = StringUtils::sanitizeUsername(body.value("username", ""));
        const std::string password = StringUtils::trim(body.value("password", ""));
        const std::string name = StringUtils::trim(body.value("name", ""));
        const std::string email = StringUtils::trim(body.value("email", ""));
        const std::string phone = StringUtils::trim(body.value("phone", ""));
        const int initialBalance = body.value("initialBalance", kDefaultBalance);

        if (username.empty() || password.empty()) {
            statusCode = 400;
            return ResponseBuilder::status("invalid_input");
        }

        json users = repository_.loadUsers();
        if (repository_.findUser(users, username) != nullptr) {
            return ResponseBuilder::status("exists");
        }

        users.push_back({
            {"username", username},
            {"password", password},
            {"name", name.empty() ? StringUtils::defaultNameFromUsername(username) : name},
            {"email", email},
            {"phone", phone},
            {"balance", std::max(0, initialBalance)},
            {"history", json::array()},
            {"requests", json::array()}
        });

        repository_.saveUsers(users);
        return ResponseBuilder::status("success");
    }

    json login(const json& body, int& statusCode) const {
        statusCode = 200;

        const std::string username = StringUtils::sanitizeUsername(body.value("username", ""));
        const std::string password = StringUtils::trim(body.value("password", ""));
        json users = repository_.loadUsers();

        for (auto& user : users) {
            if (user["username"] == username && user["password"] == password) {
                return ResponseBuilder::status("success", user["balance"].get<int>());
            }
        }

        return ResponseBuilder::status("fail");
    }

    json listUsers() const {
        json users = repository_.loadUsers();
        json response = json::array();

        for (const auto& user : users) {
            response.push_back(createPublicProfile(user));
        }

        return response;
    }


// profile section

  
// abstraction  getProfile
    json getProfile(const std::string& rawUsername, int& statusCode) const {
        statusCode = 200;
        //encapsulation repository
        json users = repository_.loadUsers();
        const std::string username = StringUtils::sanitizeUsername(rawUsername);

        if (auto* user = repository_.findUser(users, username)) {
            return createPublicProfile(*user);
        }

        statusCode = 404;

        return ResponseBuilder::status("invalid_user");
    }


    // update profile section

//abstraction 
    json updateProfile(const json& body, int& statusCode) const {
        statusCode = 200;

        const std::string username = StringUtils::sanitizeUsername(body.value("username", ""));
        const std::string name = StringUtils::trim(body.value("name", ""));
        const std::string email = StringUtils::trim(body.value("email", ""));
        const std::string phone = StringUtils::trim(body.value("phone", ""));
//encapsulation
        json users = repository_.loadUsers();
        json* user = repository_.findUser(users, username);

        if (user == nullptr) {
            statusCode = 404;
            return ResponseBuilder::status("invalid_user");
        }

        (*user)["name"] = name.empty() ? StringUtils::defaultNameFromUsername(username) : name;
        (*user)["email"] = email;
        (*user)["phone"] = phone;
//encapsulation
        repository_.saveUsers(users);
        return createPublicProfile(*user);
    }




    // change pin section 

//abstraction
    json changePin(const json& body, int& statusCode) const {
        statusCode = 200;

        const std::string username = StringUtils::sanitizeUsername(body.value("username", ""));
        const std::string oldPin = StringUtils::trim(body.value("oldPin", ""));
        const std::string newPin = StringUtils::trim(body.value("newPin", ""));
//encapsulation
        json users = repository_.loadUsers();
        json* user = repository_.findUser(users, username);

        if (user == nullptr) {
            statusCode = 404;
            return ResponseBuilder::status("invalid_user");
        }

        if ((*user)["password"] != oldPin) {
            statusCode = 401;
            return ResponseBuilder::status("invalid_pin");
        }

        (*user)["password"] = newPin;
        repository_.saveUsers(users);
        return ResponseBuilder::status("success");
    }



    json sendMoney(const json& body, int& statusCode) const {
        statusCode = 200;

        const std::string senderUsername = StringUtils::sanitizeUsername(body.value("sender", ""));
        const std::string receiverUsername = StringUtils::sanitizeUsername(body.value("receiver", ""));
        const std::string pin = StringUtils::trim(body.value("pin", ""));
        const int amount = body.value("amount", 0);

        json users = repository_.loadUsers();
        json* sender = repository_.findUser(users, senderUsername);
        json* receiver = repository_.findUser(users, receiverUsername);

        if (senderUsername == receiverUsername) {
            statusCode = 400;
            return ResponseBuilder::status("self_transfer");
        }

        if (sender == nullptr || receiver == nullptr) {
            statusCode = 404;
            return ResponseBuilder::status("invalid_user");
        }

        if (pin.empty() || (*sender)["password"] != pin) {
            statusCode = 401;
            return ResponseBuilder::status("invalid_pin");
        }

        if (amount <= 0) {
            statusCode = 400;
            return ResponseBuilder::status("invalid_amount");
        }

        if ((*sender)["balance"].get<int>() < amount) {
            statusCode = 400;
            return ResponseBuilder::status("low_balance", (*sender)["balance"].get<int>());
        }

        const int spentToday = calculateTodaySpent(*sender);
        if (spentToday + amount > kDailyTransferLimit) {
            statusCode = 400;
            return ResponseBuilder::dailyLimitExceeded(spentToday);
        }

        completeTransfer(*sender, *receiver, amount, "Sent", "Received", senderUsername, receiverUsername);
        repository_.saveUsers(users);

        return ResponseBuilder::status("success", (*sender)["balance"].get<int>());
    }




    json createRequest(const json& body, int& statusCode) const {
        statusCode = 200;

        const std::string senderUsername = StringUtils::sanitizeUsername(body.value("sender", ""));
        const std::string receiverUsername = StringUtils::sanitizeUsername(body.value("receiver", ""));
        const int amount = body.value("amount", 0);

        json users = repository_.loadUsers();
        json* receiver = repository_.findUser(users, receiverUsername);

        if (senderUsername == receiverUsername) {
            statusCode = 400;
            return ResponseBuilder::status("self_request");
        }

        if (receiver == nullptr) {
            statusCode = 404;
            return ResponseBuilder::status("invalid_user");
        }

        if (amount <= 0) {
            statusCode = 400;
            return ResponseBuilder::status("invalid_amount");
        }

        (*receiver)["requests"].push_back({
            {"from", senderUsername},
            {"amount", amount}
        });

        repository_.saveUsers(users);
        return ResponseBuilder::status("success");
    }



    json getRequests(const std::string& rawUsername) const {
        json users = repository_.loadUsers();
        const std::string username = StringUtils::sanitizeUsername(rawUsername);

        if (auto* user = repository_.findUser(users, username)) {
            return (*user)["requests"];
        }

        return json::array();
    }




    json acceptRequest(const json& body, int& statusCode) const {
        statusCode = 200;

        const std::string payerUsername = StringUtils::sanitizeUsername(body.value("sender", ""));
        const std::string requesterUsername = StringUtils::sanitizeUsername(body.value("receiver", ""));
        const std::string pin = StringUtils::trim(body.value("pin", ""));
        const int amount = body.value("amount", 0);

        json users = repository_.loadUsers();
        json* payer = repository_.findUser(users, payerUsername);
        json* requester = repository_.findUser(users, requesterUsername);

        if (payer == nullptr || requester == nullptr) {
            statusCode = 404;
            return ResponseBuilder::status("invalid_user");
        }

        if (pin.empty() || (*payer)["password"] != pin) {
            statusCode = 401;
            return ResponseBuilder::status("invalid_pin");
        }

        auto& requests = (*payer)["requests"];
        auto requestIt = std::find_if(requests.begin(), requests.end(), [&](const json& item) {
            return item.value("from", "") == requesterUsername && item.value("amount", 0) == amount;
        });

        if (requestIt == requests.end()) {
            statusCode = 404;
            return ResponseBuilder::status("request_not_found");
        }

        if ((*payer)["balance"].get<int>() < amount) {
            statusCode = 400;
            return ResponseBuilder::status("low_balance", (*payer)["balance"].get<int>());
        }

        const int spentToday = calculateTodaySpent(*payer);
        if (spentToday + amount > kDailyTransferLimit) {
            statusCode = 400;
            return ResponseBuilder::dailyLimitExceeded(spentToday);
        }

        completeTransfer(*payer, *requester, amount, "Paid", "Received", payerUsername, requesterUsername);
        requests.erase(requestIt);
        repository_.saveUsers(users);

        return ResponseBuilder::status("success", (*payer)["balance"].get<int>());
    }



    json rejectRequest(const json& body) const {
        const std::string username = StringUtils::sanitizeUsername(body.value("user", ""));
        const std::string from = StringUtils::sanitizeUsername(body.value("from", ""));
        const int amount = body.value("amount", 0);

        json users = repository_.loadUsers();
        json* user = repository_.findUser(users, username);

        if (user != nullptr) {
            auto& requests = (*user)["requests"];
            requests.erase(
                std::remove_if(requests.begin(), requests.end(), [&](const json& item) {
                    return item.value("from", "") == from && item.value("amount", 0) == amount;
                }),
                requests.end());
            repository_.saveUsers(users);
        }

        return ResponseBuilder::status("success");
    }



    // Transaction history section


    json getHistory(const std::string& rawUsername) const {
        json users = repository_.loadUsers();
        const std::string username = StringUtils::sanitizeUsername(rawUsername);

        if (auto* user = repository_.findUser(users, username)) {
            return (*user)["history"];
        }

        return json::array();
    }

private:
    // Encapsulation: these helper methods keep transfer calculations and
    // history updates inside the service, where the wallet rules belong.
    int extractAmountFromHistoryEntry(const std::string& entry) const {
        std::smatch match;
        if (std::regex_search(entry, match, std::regex(R"((\d+))"))) {
            return std::stoi(match[1].str());
        }
        return 0;
    }

    int calculateTodaySpent(const json& user) const {
        if (!user.contains("history") || !user["history"].is_array()) {
            return 0;
        }

        int spent = 0;
        for (const auto& item : user["history"]) {
            if (!item.is_string()) {
                continue;
            }

            const std::string entry = item.get<std::string>();
            const std::string lowerEntry = StringUtils::toLower(entry);

            if (!TimeUtils::isTodayHistoryEntry(entry)) {
                continue;
            }

            if (lowerEntry.find("sent") != std::string::npos || lowerEntry.find("paid") != std::string::npos) {
                spent += extractAmountFromHistoryEntry(entry);
            }
        }

        return spent;
    }

    void completeTransfer(json& sender,
                          json& receiver,
                          int amount,
                          const std::string& senderAction,
                          const std::string& receiverAction,
                          const std::string& senderUsername,
                          const std::string& receiverUsername) const {
        const std::string timestamp = TimeUtils::nowString();

        sender["balance"] = sender["balance"].get<int>() - amount;
        receiver["balance"] = receiver["balance"].get<int>() + amount;

        sender["history"].push_back(senderAction + " Rs." + std::to_string(amount) + " to " + receiverUsername + " on " + timestamp);
        receiver["history"].push_back(receiverAction + " Rs." + std::to_string(amount) + " from " + senderUsername + " on " + timestamp);
    }

    const UserRepository& repository_;
};




class WalletServer {
public:
    // Composition: WalletServer is built using smaller objects
    // (repository + service + HTTP server) to organize the system by role.
    WalletServer() : service_(repository_) {}

    void start() {
        configureRoutes();
        std::cout << "Server running at http://localhost:8080\n";
        server_.listen("0.0.0.0", 8080);
    }



private:
    // Encapsulation: route registration is hidden inside the server class,
    // so startup code stays simple and the HTTP layer stays organized.
    void configureRoutes() {
        server_.Options(R"(.*)", [](const httplib::Request&, httplib::Response& res) {
            setCorsHeaders(res);
            res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
            res.set_header("Access-Control-Allow-Headers", "Content-Type");
            res.status = 200;
        });

        server_.Get("/", [&](const httplib::Request&, httplib::Response& res) {
            setCorsHeaders(res);
            res.set_content("Server running!", "text/plain");
        });

        server_.Post("/signup", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int& statusCode) {
                return service_.signUp(body, statusCode);
            });
        });

        server_.Post("/login", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int& statusCode) {
                return service_.login(body, statusCode);
            });
        });

        server_.Get("/users", [&](const httplib::Request&, httplib::Response& res) {
            setJsonResponse(res, service_.listUsers());
        });

        server_.Get(R"(/profile/(.+))", [&](const httplib::Request& req, httplib::Response& res) {
            int statusCode = 200;
            const json response = service_.getProfile(req.matches[1], statusCode);
            setJsonResponse(res, response, statusCode);
        });

        server_.Post("/update_profile", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int& statusCode) {
                return service_.updateProfile(body, statusCode);
            });
        });

        server_.Post("/change_pin", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int& statusCode) {
                return service_.changePin(body, statusCode);
            });
        });

        server_.Post("/send", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int& statusCode) {
                return service_.sendMoney(body, statusCode);
            });
        });

        server_.Post("/request", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int& statusCode) {
                return service_.createRequest(body, statusCode);
            });
        });

        server_.Get(R"(/requests/(.+))", [&](const httplib::Request& req, httplib::Response& res) {
            setJsonResponse(res, service_.getRequests(req.matches[1]));
        });

        server_.Post("/accept_request", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int& statusCode) {
                return service_.acceptRequest(body, statusCode);
            });
        });

        server_.Post("/reject_request", [&](const httplib::Request& req, httplib::Response& res) {
            handleJsonRequest(req, res, [&](const json& body, int&) {
                return service_.rejectRequest(body);
            });
        });

        server_.Get(R"(/history/(.+))", [&](const httplib::Request& req, httplib::Response& res) {
            setJsonResponse(res, service_.getHistory(req.matches[1]));
        });
    }

    template <typename Handler>
    void handleJsonRequest(const httplib::Request& req, httplib::Response& res, Handler handler) {
        try {
            const json body = json::parse(req.body);
            int statusCode = 200;
            const json response = handler(body, statusCode);
            setJsonResponse(res, response, statusCode);
        } catch (...) {
            setJsonResponse(res, ResponseBuilder::status("error"), 500);
        }
    }

    static void setCorsHeaders(httplib::Response& res) {
        res.set_header("Access-Control-Allow-Origin", "*");
    }

    static void setJsonResponse(httplib::Response& res, const json& payload, int statusCode = 200) {
        setCorsHeaders(res);
        res.status = statusCode;
        res.set_content(payload.dump(), "application/json");
    }

    httplib::Server server_;
    UserRepository repository_;
    WalletService service_;
};

}  // namespace

int main() {
    WalletServer server;
    server.start();
    return 0;
}
