# Digital Wallet and UPI System

A web-based digital wallet application that demonstrates wallet management and digital payment functionality using a C++ backend and a web frontend.

## Features

- User signup and login
- Wallet dashboard
- Send money between users
- Request money
- Transaction history
- User profile management
- Daily transfer limit handling
- JSON-based data storage

## Technologies Used

**Backend**
- C++
- JSON-based data handling

**Frontend**
- HTML
- CSS
- JavaScript

**Tools**
- Git
- GitHub
- Visual Studio Code

## Project Structure

```text
Digital-Wallet-and-UPI-System/
├── backend/
│   ├── server.cpp
│   ├── httplib.h
│   └── json.hpp
├── frontend/
│   ├── index.html
│   ├── signup.html
│   ├── dashboard.html
│   ├── send.html
│   ├── request.html
│   ├── history.html
│   ├── profile.html
│   ├── style.css
│   ├── dashboard.css
│   └── script.js
└── .gitignore
```

## Getting Started

1. Clone this repository:

   ```bash
   git clone https://github.com/Shrutik-25/Digital-Wallet-and-UPI-System.git
   ```

2. Open the project folder in Visual Studio Code.

3. Review `backend/server.cpp` to identify the backend's compilation requirements and startup instructions.

4. Open the frontend using the setup supported by the project, and configure the backend connection as required.

## Data Storage

The application uses JSON-based storage for user and wallet data.

**Important:** Do not commit real user information, passwords, private keys, or other sensitive data to GitHub.

## Future Improvements

- Integrate a database such as MySQL or PostgreSQL
- Add stronger authentication and password hashing
- Improve payment validation and error handling
- Add automated testing
- Improve the user interface and mobile responsiveness

## Disclaimer

This project is intended for learning and demonstration purposes. It is not a production-ready payment platform.

## Author

**Shrutik-25**

GitHub: [Shrutik-25](https://github.com/Shrutik-25)
