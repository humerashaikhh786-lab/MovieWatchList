import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;

public class MovieServer {

    private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
    private static final Watchlist WATCHLIST = new Watchlist();
    private static final String TMDB_API_KEY = loadApiKey();

    public static void main(String[] args) throws Exception {

        HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

        server.createContext("/", MovieServer::handleHome);
        server.createContext("/about.html", MovieServer::handleAbout);
        server.createContext("/api/movies", MovieServer::handleMovies);
        server.createContext("/api/movies/action", MovieServer::handleMovieAction);
        server.createContext("/api/stats", MovieServer::handleStats);
        server.createContext("/api/search", MovieServer::handleSearch);
        server.createContext("/api/movie-details", MovieServer::handleDetails);
        server.createContext("/api/watch-providers", MovieServer::handleWatchProviders);
        server.createContext("/api/person-details", MovieServer::handlePersonDetails);

        server.setExecutor(null);

        System.out.println("--------------------------------------");
        System.out.println(" MovieWatchList Server Started");
        System.out.println("--------------------------------------");
        System.out.println("Open: http://localhost:8080");
        System.out.println("--------------------------------------");

        server.start();
    }

    private static String loadApiKey() {
        Path env = Paths.get(".env");

        try {
            if (!Files.exists(env)) {
                throw new IOException(".env file not found.");
            }

            for (String line : Files.readAllLines(env)) {
                line = line.trim();

                if (line.startsWith("TMDB_API_KEY=")) {
                    String key = line.substring("TMDB_API_KEY=".length()).trim();

                    if (!key.isEmpty() && !key.equals("YOUR_NEW_REAL_TMDB_KEY")) {
                        return key;
                    }
                }
            }
        } catch (IOException e) {
            throw new RuntimeException("Could not read .env file.", e);
        }

        throw new RuntimeException("TMDB_API_KEY not found in .env file.");
    }

    // =========================================================
    // STATIC FILES
    // =========================================================

    private static void handleHome(HttpExchange exchange) throws IOException {

        String path = exchange.getRequestURI().getPath();

        switch (path) {
            case "/":
            case "/index.html":
                sendFile(exchange, "web/index.html", "text/html; charset=UTF-8");
                break;

            case "/style.css":
                sendFile(exchange, "web/style.css", "text/css; charset=UTF-8");
                break;

            case "/script.js":
                sendFile(exchange, "web/script.js", "application/javascript; charset=UTF-8");
                break;

            case "/imgmovie.png":
            case "/favicon.png":
                sendFile(exchange, "web/imgmovie.png", "image/png");
                break;

            default:
                sendResponse(exchange, 404, "404 - File Not Found", "text/plain; charset=UTF-8");
        }
    }

    private static void handleAbout(HttpExchange exchange) throws IOException {
        sendFile(exchange, "web/about.html", "text/html; charset=UTF-8");
    }

    private static void sendFile(HttpExchange exchange, String file, String contentType)
            throws IOException {

        Path path = Paths.get(file);

        if (!Files.exists(path)) {
            sendResponse(exchange, 404, "File not found: " + file, "text/plain; charset=UTF-8");
            return;
        }

        byte[] data = Files.readAllBytes(path);

        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("Cache-Control", "no-cache, no-store, must-revalidate");
        exchange.sendResponseHeaders(200, data.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(data);
        }
    }

    // =========================================================
    // WATCHLIST API
    // =========================================================

    private static void handleMovies(HttpExchange exchange) throws IOException {

        String method = exchange.getRequestMethod();

        if (method.equalsIgnoreCase("GET")) {
            sendResponse(exchange, 200, moviesToJson(WATCHLIST.getMovies()), "application/json");
            return;
        }

        if (method.equalsIgnoreCase("POST")) {

            String body = new String(
                    exchange.getRequestBody().readAllBytes(),
                    StandardCharsets.UTF_8
            );

            String title = formValue(body, "title");
            String genre = formValue(body, "genre");
            int year = parseInt(formValue(body, "year"), 0);
            double rating = parseDouble(formValue(body, "rating"), 0);
            boolean watched = Boolean.parseBoolean(formValue(body, "watched"));
            boolean favorite = Boolean.parseBoolean(formValue(body, "favorite"));
            String imageUrl = formValue(body, "imageUrl");
            String description = formValue(body, "description");
            String type = formValue(body, "type");
            String region = formValue(body, "region");
            int seasons = parseInt(formValue(body, "seasons"), 0);
            int episodes = parseInt(formValue(body, "episodes"), 0);
            int tmdbId = parseInt(formValue(body, "tmdbId"), 0);

            if (title.isBlank()) {
                sendResponse(exchange, 400, "{\"error\":\"Title is required\"}", "application/json");
                return;
            }

            Movie movie = WATCHLIST.addMovie(
                    title,
                    genre,
                    year,
                    rating,
                    watched,
                    favorite,
                    imageUrl,
                    description,
                    type.isBlank() ? "movie" : type,
                    region,
                    seasons,
                    episodes,
                    tmdbId
            );

            sendResponse(exchange, 201, movieToJson(movie), "application/json");
            return;
        }

        if (method.equalsIgnoreCase("DELETE")) {

            String id = getQueryParameter(exchange.getRequestURI().getQuery(), "id");

            if (id == null) {
                sendResponse(exchange, 400, "{\"error\":\"ID required\"}", "application/json");
                return;
            }

            boolean deleted = WATCHLIST.deleteMovie(parseInt(id, -1));

            sendResponse(
                    exchange,
                    deleted ? 200 : 404,
                    "{\"success\":" + deleted + "}",
                    "application/json"
            );
            return;
        }

        sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}", "application/json");
    }

    private static void handleMovieAction(HttpExchange exchange) throws IOException {

        if (!exchange.getRequestMethod().equalsIgnoreCase("POST")) {
            sendResponse(exchange, 405, "{\"error\":\"Method not allowed\"}", "application/json");
            return;
        }

        String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        int id = parseInt(formValue(body, "id"), -1);
        String action = formValue(body, "action");

        Movie movie = WATCHLIST.findMovie(id);
        if (movie == null) {
            sendResponse(exchange, 404, "{\"error\":\"Title not found\"}", "application/json");
            return;
        }

        if ("watched".equalsIgnoreCase(action)) {
            movie.setWatched(true);
        } else if ("unwatched".equalsIgnoreCase(action)) {
            movie.setWatched(false);
        } else if ("favoriteToggle".equalsIgnoreCase(action)) {
            movie.setFavorite(!movie.isFavorite());
        } else {
            sendResponse(exchange, 400, "{\"error\":\"Unknown action\"}", "application/json");
            return;
        }

        // Save watched/favorite changes so they survive server restarts.
        WATCHLIST.save();

        sendResponse(exchange, 200, movieToJson(movie), "application/json");
    }

    private static void handleStats(HttpExchange exchange) throws IOException {

        String json = "{"
                + "\"total\":" + WATCHLIST.getTotalMovies() + ","
                + "\"watched\":" + WATCHLIST.getWatchedMovies() + ","
                + "\"unwatched\":" + WATCHLIST.getUnwatchedMovies() + ","
                + "\"average\":" + String.format(
                        java.util.Locale.US,
                        "%.1f",
                        WATCHLIST.getAverageRating())
                + "}";

        sendResponse(exchange, 200, json, "application/json");
    }

    // =========================================================
    // TMDB SEARCH
    // =========================================================

    private static void handleSearch(HttpExchange exchange) throws IOException {

        try {
            String query = getQueryParameter(exchange.getRequestURI().getQuery(), "query");
            String type = getQueryParameter(exchange.getRequestURI().getQuery(), "type");

            if (query == null || query.trim().isEmpty()) {
                sendResponse(exchange, 400, "{\"error\":\"Search query required\"}", "application/json");
                return;
            }

            if ("tv".equalsIgnoreCase(type)) {
                sendResponse(exchange, 200, searchTMDB(query, "tv"), "application/json");
            } else {
                sendResponse(exchange, 200, searchTMDB(query, "movie"), "application/json");
            }

        } catch (Exception e) {
            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\":\"TMDB search failed\"}", "application/json");
        }
    }

    private static String searchTMDB(String query, String type) throws Exception {

        String url = "https://api.themoviedb.org/3/search/" + type
                + "?api_key=" + URLEncoder.encode(TMDB_API_KEY, StandardCharsets.UTF_8)
                + "&query=" + URLEncoder.encode(query, StandardCharsets.UTF_8)
                + "&language=en-US";

        return tmdbRequest(url);
    }

    // =========================================================
    // TMDB DETAILS
    // =========================================================

    private static void handleDetails(HttpExchange exchange) throws IOException {

        try {
            String id = getQueryParameter(exchange.getRequestURI().getQuery(), "id");
            String type = getQueryParameter(exchange.getRequestURI().getQuery(), "type");

            if (id == null) {
                sendResponse(exchange, 400, "{\"error\":\"ID required\"}", "application/json");
                return;
            }

            String tmdbType = "tv".equalsIgnoreCase(type) ? "tv" : "movie";

            String url = "https://api.themoviedb.org/3/" + tmdbType + "/"
                    + URLEncoder.encode(id, StandardCharsets.UTF_8)
                    + "?api_key=" + URLEncoder.encode(TMDB_API_KEY, StandardCharsets.UTF_8)
                    + "&language=en-US"
                    + "&append_to_response=credits";

            sendResponse(exchange, 200, tmdbRequest(url), "application/json");

        } catch (Exception e) {
            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\":\"Details failed\"}", "application/json");
        }
    }

    // =========================================================
    // PERSON / ACTOR DETAILS
    // =========================================================

    private static void handlePersonDetails(HttpExchange exchange) throws IOException {

        try {
            String id = getQueryParameter(exchange.getRequestURI().getQuery(), "id");

            if (id == null) {
                sendResponse(exchange, 400, "{\"error\":\"Person ID required\"}", "application/json");
                return;
            }

            String url = "https://api.themoviedb.org/3/person/"
                    + URLEncoder.encode(id, StandardCharsets.UTF_8)
                    + "?api_key=" + URLEncoder.encode(TMDB_API_KEY, StandardCharsets.UTF_8)
                    + "&language=en-US"
                    + "&append_to_response=combined_credits";

            sendResponse(exchange, 200, tmdbRequest(url), "application/json");

        } catch (Exception e) {
            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\":\"Person details failed\"}", "application/json");
        }
    }

    // =========================================================
    // WATCH PROVIDERS
    // =========================================================

    private static void handleWatchProviders(HttpExchange exchange) throws IOException {

        try {
            String id = getQueryParameter(exchange.getRequestURI().getQuery(), "id");
            String type = getQueryParameter(exchange.getRequestURI().getQuery(), "type");

            if (id == null) {
                sendResponse(exchange, 400, "{\"error\":\"ID required\"}", "application/json");
                return;
            }

            String tmdbType = "tv".equalsIgnoreCase(type) ? "tv" : "movie";

            String url = "https://api.themoviedb.org/3/" + tmdbType + "/"
                    + URLEncoder.encode(id, StandardCharsets.UTF_8)
                    + "/watch/providers"
                    + "?api_key=" + URLEncoder.encode(TMDB_API_KEY, StandardCharsets.UTF_8);

            sendResponse(exchange, 200, tmdbRequest(url), "application/json");

        } catch (Exception e) {
            e.printStackTrace();
            sendResponse(exchange, 500, "{\"error\":\"Watch provider lookup failed\"}", "application/json");
        }
    }

    private static String tmdbRequest(String url) throws Exception {

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpResponse<String> response = HTTP_CLIENT.send(
                request,
                HttpResponse.BodyHandlers.ofString()
        );

        return response.body();
    }

    // =========================================================
    // JSON
    // =========================================================

    private static String movieToJson(Movie movie) {

        return "{"
                + "\"id\":" + movie.getId() + ","
                + "\"tmdbId\":" + movie.getTmdbId() + ","
                + "\"title\":\"" + escape(movie.getTitle()) + "\","
                + "\"genre\":\"" + escape(movie.getGenre()) + "\","
                + "\"year\":" + movie.getYear() + ","
                + "\"rating\":" + movie.getRating() + ","
                + "\"watched\":" + movie.isWatched() + ","
                + "\"favorite\":" + movie.isFavorite() + ","
                + "\"imageUrl\":\"" + escape(movie.getImageUrl()) + "\","
                + "\"description\":\"" + escape(movie.getDescription()) + "\","
                + "\"type\":\"" + escape(movie.getType()) + "\","
                + "\"region\":\"" + escape(movie.getRegion()) + "\","
                + "\"seasons\":" + movie.getSeasons() + ","
                + "\"episodes\":" + movie.getEpisodes()
                + "}";
    }

    private static String moviesToJson(List<Movie> movies) {

        StringBuilder json = new StringBuilder("[");

        for (int i = 0; i < movies.size(); i++) {
            json.append(movieToJson(movies.get(i)));

            if (i < movies.size() - 1) {
                json.append(",");
            }
        }

        return json.append("]").toString();
    }

    private static String escape(String value) {

        if (value == null) return "";

        return value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "\\r")
                .replace("\n", "\\n")
                .replace("\t", "\\t");
    }

    // =========================================================
    // FORM HELPERS
    // =========================================================

    private static String formValue(String body, String key) {

        if (body == null || body.isEmpty()) return "";

        for (String pair : body.split("&")) {

            String[] parts = pair.split("=", 2);

            if (parts.length == 2 && parts[0].equals(key)) {
                return urlDecode(parts[1]);
            }
        }

        return "";
    }

    private static String getQueryParameter(String query, String key) {

        if (query == null || query.isEmpty()) return null;

        for (String pair : query.split("&")) {

            String[] parts = pair.split("=", 2);

            if (parts.length == 2 && parts[0].equals(key)) {
                return urlDecode(parts[1]);
            }
        }

        return null;
    }

    private static String urlDecode(String value) {

        try {
            return java.net.URLDecoder.decode(value, StandardCharsets.UTF_8);
        } catch (Exception e) {
            return value;
        }
    }

    private static int parseInt(String value, int fallback) {

        try {
            return Integer.parseInt(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static double parseDouble(String value, double fallback) {

        try {
            return Double.parseDouble(value);
        } catch (Exception e) {
            return fallback;
        }
    }

    private static void sendResponse(
            HttpExchange exchange,
            int status,
            String response,
            String contentType) throws IOException {

        byte[] bytes = response.getBytes(StandardCharsets.UTF_8);

        exchange.getResponseHeaders().set(
                "Content-Type",
                contentType + "; charset=UTF-8"
        );

        exchange.getResponseHeaders().set(
                "Cache-Control",
                "no-cache, no-store, must-revalidate"
        );

        exchange.sendResponseHeaders(status, bytes.length);

        try (OutputStream output = exchange.getResponseBody()) {
            output.write(bytes);
        }
    }
}
