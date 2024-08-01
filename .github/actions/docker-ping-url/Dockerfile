FROM python:alpine3.20

WORKDIR /app

COPY requirements.txt .

RUN python -V
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

CMD ["echo $INPUT_MAX_ATTEMPTS", "python", "/app/main.py"]