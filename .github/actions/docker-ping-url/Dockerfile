FROM python:alpine3.20

WORKDIR /app

COPY requirements.txt .

RUN python -V
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
RUN echo 'env | sort > /tmp/env_vars.txt && cat /tmp/env_vars.txt' > /print_env.sh && chmod +x /print_env.sh

CMD ["python", "/app/main.py"]