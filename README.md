# RiceUp Backend

Backend server for rice price prediction using linear regression.

## Features

- Rice price data management
- Current price retrieval
- Historical price data
- Price prediction using linear regression
- RESTful API

## Deployment on Render

1. Fork this repository to your GitHub account
2. Go to [Render.com](https://render.com) and sign up/login
3. Click "New +" and select "Web Service"
4. Connect your GitHub account and select the `riceup-backend` repository
5. Use these settings:
   - **Name**: `riceup-backend` (or your preferred name)
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main`
   - **Root Directory**: (leave empty)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Click "Create Web Service"

## API Endpoints

- `GET /health` - Health check
- `GET /prices/types` - Get available rice types and categories
- `GET /prices/current` - Get current prices
- `GET /prices/historical` - Get historical prices (with optional type/category filters)
- `POST /predict` - Predict future prices

## Prediction Request

```json
POST /predict
{
  "type": "LOCAL",
  "category": "Special", 
  "weeks_ahead": 4
}