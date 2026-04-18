FROM python:3.13

WORKDIR /app

COPY app.py .

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

ENV GATEWAY_URL=http://gateway:8000

EXPOSE 8501

CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
