# serbisyongScholars

# SERBISYONG SCHOLAR - HOW TO RUN

# 1. Open your terminal and navigate to the root directory (where manage.py is located)
# cd path/to/serbisyongScholars

# 2. Create a clean virtual environment using Python 
python -m venv venv

# 3. Activate the virtual environment
# On Mac/Linux:
source venv/bin/activate
# On Windows:
# venv\Scripts\activate

# 4. Upgrade pip and install the required dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 5. Create your environment variables file
# Create a file named .env in the exact same folder as manage.py and paste this inside:
# ----------------------------------------
# SECRET_KEY=your_secret_key_here
# DEBUG=True
# DB_NAME=your_postgres_db_name
# DB_USER=your_postgres_username
# DB_PASSWORD=your_postgres_password
# DB_HOST=localhost
# DB_PORT=5432
# EMAIL_HOST_USER=your_email@gmail.com
# EMAIL_HOST_PASSWORD=your_email_app_password
# SITE_URL=http://127.0.0.1:8000
# ----------------------------------------

# 6. Apply database migrations to create your tables
python manage.py makemigrations
python manage.py migrate

# 7. Create an admin account (superuser) so you can manage the app
python manage.py createsuperuser

# 8. Start the development server
python manage.py runserver

# The site is now running at: http://127.0.0.1:8000/