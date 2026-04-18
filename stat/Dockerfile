FROM golang:1.24-bookworm

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY *.go ./

RUN CGO_ENABLED=0 go build -o stat .

ENV STAT_PORT=8002
ENV SQLITE_PATH=/data/listenai.db

EXPOSE 8002

CMD ["./stat"]
