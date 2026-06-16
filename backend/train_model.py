import os
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score
import joblib

def generate_synthetic_data(num_samples=1200):
    np.random.seed(42)
    
    # 1. Generate features
    distance = np.random.uniform(1.0, 25.0, num_samples) # km
    wind_speed = np.random.uniform(0.0, 50.0, num_samples) # km/h
    weather_options = ['clear', 'windy', 'rainy', 'stormy']
    weather_condition = np.random.choice(weather_options, num_samples)
    battery_percentage = np.random.uniform(15.0, 100.0, num_samples) # %
    parcel_weight = np.random.uniform(0.0, 5.0, num_samples) # kg
    congestion_level = np.random.uniform(1.0, 5.0, num_samples) # 1 to 5 scale
    
    # 2. Base speed based on weather (matching server.py calculations)
    # clear: 60 km/h, windy: 40 km/h, rainy: 35 km/h, stormy: 15 km/h
    speed_map = {'clear': 60.0, 'windy': 40.0, 'rainy': 35.0, 'stormy': 15.0}
    base_speed = np.array([speed_map[w] for w in weather_condition])
    
    # Cargo weight penalty: -2 km/h per kg
    payload_speed_penalty = parcel_weight * 2.0
    effective_speed = base_speed - payload_speed_penalty
    effective_speed = np.maximum(10.0, effective_speed) # speed cap minimum
    
    # Base travel time in minutes
    base_time_mins = (distance / effective_speed) * 60.0
    
    # Delays and impacts
    # High wind speed causes drag/slowdowns
    wind_delay = 0.015 * wind_speed * distance
    
    # Airspace congestion (detours, holding patterns)
    congestion_delay = 0.5 * (congestion_level - 1.0) * (distance ** 0.5)
    
    # Battery conservation mode: low battery (< 35%) triggers eco-cruising (15% slower)
    battery_slowdown_factor = np.where(battery_percentage < 35.0, 0.15, 0.0)
    battery_delay = battery_slowdown_factor * base_time_mins
    
    # Small random noise (communication latency, wind gusts, minor adjustments)
    noise = np.random.normal(0.0, 0.2, num_samples)
    
    # Combine to get target variable
    delivery_time = base_time_mins + wind_delay + congestion_delay + battery_delay + noise
    delivery_time = np.maximum(1.0, delivery_time) # Cap at min 1 minute
    
    # 3. Create DataFrame
    df = pd.DataFrame({
        'distance': np.round(distance, 2),
        'wind_speed': np.round(wind_speed, 1),
        'weather_condition': weather_condition,
        'battery_percentage': np.round(battery_percentage, 1),
        'parcel_weight': np.round(parcel_weight, 2),
        'congestion_level': np.round(congestion_level, 2),
        'delivery_time': np.round(delivery_time, 2)
    })
    
    return df

def train_and_evaluate():
    print("🤖 Step 1: Generating synthetic drone delivery dataset...")
    df = generate_synthetic_data(1200)
    
    # Save synthetic dataset to CSV
    os.makedirs('backend', exist_ok=True)
    dataset_path = 'backend/delivery_dataset.csv'
    df.to_csv(dataset_path, index=False)
    print(f"✅ Dataset generated and saved to: {dataset_path} ({len(df)} records)")
    
    # 2. Encode categorical columns
    # clear -> 0, windy -> 1, rainy -> 2, stormy -> 3
    weather_encoding = {'clear': 0, 'windy': 1, 'rainy': 2, 'stormy': 3}
    df_encoded = df.copy()
    df_encoded['weather_condition'] = df_encoded['weather_condition'].map(weather_encoding)
    
    # 3. Split features and target
    X = df_encoded[['distance', 'wind_speed', 'weather_condition', 'battery_percentage', 'parcel_weight', 'congestion_level']]
    y = df_encoded['delivery_time']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # 4. Train Random Forest Regressor
    print("🚀 Step 2: Training RandomForestRegressor...")
    model = RandomForestRegressor(n_estimators=100, max_depth=12, random_state=42)
    model.fit(X_train, y_train)
    
    # 5. Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    
    print("\n📈 Model Evaluation Report:")
    print(f"   Mean Absolute Error (MAE): {mae:.4f} minutes")
    print(f"   R² Score (Accuracy):       {r2:.4%}")
    
    # 6. Save model and encoding dict
    model_data = {
        'model': model,
        'weather_encoding': weather_encoding,
        'features': list(X.columns),
        'metrics': {
            'mae': mae,
            'r2': r2
        }
    }
    
    model_path = 'backend/delivery_model.joblib'
    joblib.dump(model_data, model_path)
    print(f"\n💾 Model package saved successfully to: {model_path}\n")

if __name__ == '__main__':
    train_and_evaluate()
