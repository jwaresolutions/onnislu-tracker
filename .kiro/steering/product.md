# Product Overview

ONNISLU Price Tracker is a web application that monitors apartment availability and pricing for ONNISLU buildings (Fairview and Boren). The system automatically scrapes data from SecureCafe and building websites, tracks price changes over time, and provides alerts when prices drop below configured thresholds.

## Core Features

- Automated web scraping with Puppeteer on scheduled intervals
- SQLite database for historical price tracking
- REST API serving floor plans, prices, availability, and alerts
- React frontend with Material-UI for data visualization and filtering
- CSV export functionality for data analysis
- Configurable price drop alerts (dollar or percentage thresholds)
- Health monitoring and status endpoints

## User Workflows

- View current apartment availability and pricing across buildings
- Filter units by bedrooms, bathrooms, den, square footage, and price range
- Track price history trends over time with charts
- Receive alerts when prices drop significantly
- Export historical data for external analysis
- Manually trigger scraping jobs via API
