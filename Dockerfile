FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY src ./src
COPY web ./web
COPY data ./data
RUN mkdir out && javac -d out src/*.java
