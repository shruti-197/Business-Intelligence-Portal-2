import os
import pandas as pd
from flask import Flask, jsonify, request

app = Flask(__name__, static_folder='Frontend', static_url_path='')

DATASET_DIR = os.path.join(os.path.dirname(__file__), 'Frontend', 'Dataset')

# Serve Static HTML files
@app.route('/')
def index():
    return app.send_static_file('index.html')

@app.route('/<path:path>')
def serve_html(path):
    if os.path.exists(os.path.join(app.static_folder, path)):
        return app.send_static_file(path)
    return "Page not found", 404

# API: Authenticate Internal Employees
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json or {}
    email = data.get('email', '').strip().rstrip(',').lower()
    password = data.get('password', '').strip().lower() # Make password case-insensitive per user request
    role_requested = data.get('role', '').strip().lower()
    
    try:
        if role_requested == 'admin':
            df = pd.read_csv(os.path.join(DATASET_DIR, 'employees.csv'))
            df['email'] = df['email'].astype(str).str.strip().str.lower()
            df['password'] = df['password'].astype(str).str.strip().str.lower()
            df['role'] = df['role'].astype(str).str.strip().str.lower()
            
            user = df[(df['email'] == email) & (df['password'] == password) & (df['role'] == 'admin')]
            if not user.empty:
                return jsonify({'success': True, 'role': 'admin', 'name': user.iloc[0]['name']})
                
        else:
            # Check cleaned_users_final.csv for regular users
            df = pd.read_csv(os.path.join(DATASET_DIR, 'cleaned_users_final.csv'))
            df['email'] = df['email'].astype(str).str.strip().str.lower()
            df['password'] = df['password'].astype(str).str.strip().str.lower()
            
            user = df[(df['email'] == email) & (df['password'] == password)]
            if not user.empty:
                return jsonify({'success': True, 'role': 'user', 'name': user.iloc[0]['name']})
            else:
                # Fallback to employees.csv for users just in case
                df_emp = pd.read_csv(os.path.join(DATASET_DIR, 'employees.csv'))
                df_emp['email'] = df_emp['email'].astype(str).str.strip().str.lower()
                df_emp['password'] = df_emp['password'].astype(str).str.strip().str.lower()
                df_emp['role'] = df_emp['role'].astype(str).str.strip().str.lower()
                
                user_emp = df_emp[(df_emp['email'] == email) & (df_emp['password'] == password) & (df_emp['role'] == 'user')]
                if not user_emp.empty:
                    return jsonify({'success': True, 'role': 'user', 'name': user_emp.iloc[0]['name']})
        
        return jsonify({'success': False, 'message': 'Invalid credentials'}), 401
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

# API: Get or Add Sales Data (Limited to 100 rows for frontend performance on GET)
@app.route('/api/sales', methods=['GET', 'POST'])
def manage_sales():
    file_path = os.path.join(DATASET_DIR, 'cleaned_sales_final.csv')
    try:
        if request.method == 'GET':
            # Since new records are appended to the bottom, let's read everything and get the last 100
            df = pd.read_csv(file_path)
            df = df.tail(100) # Get latest 100
            # Handle NaN values to prevent JSON errors
            df = df.fillna('')
            records = df.to_dict(orient='records')
            # Reverse records to show newest first
            records.reverse()
            return jsonify(records)
        
        elif request.method == 'POST':
            data = request.json
            
            df = pd.read_csv(file_path)
            new_id = int(df['id'].max() + 1) if not df.empty else 1
            
            new_row = {
                'id': new_id,
                'product_name': data.get('product_name', 'Unknown'),
                'region': data.get('region', 'Unknown'),
                'sales_amount': float(data.get('sales_amount', 0)),
                'date': data.get('date', 'Unknown'),
                'quantity': int(data.get('quantity', 0)),
                'category': data.get('category', 'Unknown'),
                'customer_id': 'C9999',
                'profit': 0.0
            }
            
            new_df = pd.DataFrame([new_row])
            df = pd.concat([df, new_df], ignore_index=True)
            df.to_csv(file_path, index=False)
            
            return jsonify({'success': True, 'message': 'Product added', 'product': new_row})
            
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API: Edit Sales Data
@app.route('/api/sales/<int:product_id>', methods=['PUT'])
def edit_sales(product_id):
    file_path = os.path.join(DATASET_DIR, 'cleaned_sales_final.csv')
    try:
        data = request.json
        df = pd.read_csv(file_path)
        
        # Find the row index
        idx = df.index[df['id'] == product_id]
        if len(idx) == 0:
            return jsonify({'success': False, 'error': 'Product not found'}), 404
            
        # Update fields
        idx = idx[0]
        df.at[idx, 'product_name'] = data.get('product_name', df.at[idx, 'product_name'])
        df.at[idx, 'category'] = data.get('category', df.at[idx, 'category'])
        df.at[idx, 'sales_amount'] = float(data.get('sales_amount', df.at[idx, 'sales_amount']))
        df.at[idx, 'quantity'] = int(data.get('quantity', df.at[idx, 'quantity']))
        df.at[idx, 'date'] = data.get('date', df.at[idx, 'date'])
        df.at[idx, 'region'] = data.get('region', df.at[idx, 'region'])
        
        # Save back to CSV
        df.to_csv(file_path, index=False)
        
        return jsonify({'success': True, 'message': 'Product updated'})
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

# API: Get Aggregated KPI Data
@app.route('/api/kpi', methods=['GET'])
def get_kpi():
    try:
        # Read live sales data for real-time KPI reflection
        sales_df = pd.read_csv(os.path.join(DATASET_DIR, 'cleaned_sales_final.csv'))
        
        # Calculate summary metrics dynamically
        total_sales = sales_df['sales_amount'].sum()
        avg_sales = sales_df['sales_amount'].mean()
        
        # Find top product and region by total sales volume
        top_product = sales_df.groupby('product_name')['sales_amount'].sum().idxmax() if not sales_df.empty else "N/A"
        best_region = sales_df.groupby('region')['sales_amount'].sum().idxmax() if not sales_df.empty else "N/A"
        
        # Keep growth from the historical KPI file as it requires temporal tracking
        try:
            kpi_df = pd.read_csv(os.path.join(DATASET_DIR, 'cleaned_kpi_final.csv'))
            avg_growth = kpi_df['monthly_growth_percent'].mean()
        except:
            avg_growth = 15.4 # Fallback
            
        kpi_summary = {
            'totalSales': float(total_sales),
            'averageSales': float(avg_sales),
            'growth': float(avg_growth),
            'topProduct': str(top_product),
            'bestRegion': str(best_region)
        }
        return jsonify(kpi_summary)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)
