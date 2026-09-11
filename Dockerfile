FROM eclipse-temurin:17-jdk

WORKDIR /app

COPY src ./src

RUN mkdir out && javac -d out src/*.java

CMD ["java", "-cp", "out", "MovieServer"]
