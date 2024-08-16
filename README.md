
# Scissors API

Welcome to the Scissors API! This API allows developers to integrate URL shortening functionality into their applications. With Scissors, you can shorten long URLs, manage them, and track their usage statistics.

## Table of Contents

- [Getting Started](#getting-started)
- [Authentication](#authentication)
- [Endpoints](#endpoints)
  - [Create Short URL](#create-short-url)
  - [Get Original URL](#get-original-url)
  - [Get URL Statistics](#get-url-statistics)
  - [Delete Short URL](#delete-short-url)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Contributing](#contributing)
- [License](#license)

## Getting Started

### Prerequisites

- **Node.js** and **npm** installed on your machine.
- A Scissors account for API key access.

### Installation

To get started, clone the repository and install the required dependencies:

\`\`\`bash
git clone https://github.com/yourusername/scissors-api.git
cd scissors-api
npm install
\`\`\`

## Authentication

The Scissors API uses API keys to authenticate requests. You can obtain your API key from the Scissors dashboard.

To authenticate your requests, include the API key in the \`Authorization\` header:

\`\`\`http
Authorization: Bearer YOUR_API_KEY
\`\`\`

## Endpoints

### Create Short URL

**POST** \`/api/urls\`

Creates a short URL from a long URL.

#### Request Body

\`\`\`json
{
  "longUrl": "https://www.example.com/very/long/url",
  "customAlias": "optional-alias" // optional
}
\`\`\`

#### Response

\`\`\`json
{
  "shortUrl": "https://scissors.io/short123",
  "originalUrl": "https://www.example.com/very/long/url",
  "customAlias": "optional-alias" // if provided
}
\`\`\`

### Get Original URL

**GET** \`/api/urls/:shortUrl\`

Retrieves the original long URL from a short URL.

#### Response

\`\`\`json
{
  "originalUrl": "https://www.example.com/very/long/url"
}
\`\`\`

### Get URL Statistics

**GET** \`/api/urls/:shortUrl/stats\`

Provides statistics about a short URL, such as the number of clicks, referrers, and geographic data.

#### Response

\`\`\`json
{
  "clicks": 120,
  "referrers": {
    "https://google.com": 30,
    "https://twitter.com": 50
  },
  "locations": {
    "United States": 70,
    "Germany": 50
  }
}
\`\`\`

### Delete Short URL

**DELETE** \`/api/urls/:shortUrl\`

Deletes a short URL.

#### Response

\`\`\`json
{
  "message": "Short URL deleted successfully."
}
\`\`\`

## Error Handling

The Scissors API returns standard HTTP status codes for successful and error responses. Here are some common status codes:

- \`200 OK\` - The request was successful.
- \`400 Bad Request\` - The request was invalid or missing parameters.
- \`401 Unauthorized\` - Authentication failed, API key invalid.
- \`404 Not Found\` - The requested resource was not found.
- \`500 Internal Server Error\` - An error occurred on the server.

## Rate Limiting

The Scissors API implements rate limiting to prevent abuse. If you exceed the allowed number of requests, you'll receive a \`429 Too Many Requests\` response.

## Contributing

We welcome contributions to improve the Scissors API. Please fork the repository, create a new branch, and submit a pull request with your changes.

## License

This project was developed by **Favour Omirin** as part of the Capstone Project at **AltSchool Africa School of Engineering**.

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
