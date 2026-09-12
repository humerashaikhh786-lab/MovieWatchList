FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY src ./src
COPY web ./web
RUN mkdir out && javac -d out src/*.java
