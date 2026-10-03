FROM eclipse-temurin:17-jdk
WORKDIR /app
COPY src ./src
COPY web ./web
COPY lib ./lib
RUN mkdir out && javac -cp "lib/mysql-connector-j-9.7.0.jar" -d out src/*.java
CMD ["java", "-cp", "out;lib/mysql-connector-j-9.7.0.jar", "MovieServer"]
