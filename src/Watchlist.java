import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;

public class Watchlist {

    private static final Path DATA_FILE = Paths.get("data", "watchlist.txt");

    private final List<Movie> movies = new ArrayList<>();
    private int nextId = 1;

    public Watchlist() {
        loadFromFile();
    }

    public Movie addMovie(String title, String genre, int year, double rating,
                          boolean watched, boolean favorite, String imageUrl, String description,
                          String type, String region, int seasons, int episodes, int tmdbId) {

        Movie existing = findByTmdbId(tmdbId, type);

        if (existing != null) {
            existing.setTitle(title);
            existing.setGenre(genre);
            existing.setYear(year);
            existing.setRating(rating);
            existing.setImageUrl(imageUrl);
            existing.setDescription(description);
            existing.setRegion(region);
            existing.setSeasons(seasons);
            existing.setEpisodes(episodes);
            existing.setWatched(existing.isWatched() || watched);
            existing.setFavorite(existing.isFavorite() || favorite);

            saveToFile();
            return existing;
        }

        Movie movie = new Movie(
                nextId++, title, genre, year, rating, watched, favorite,
                imageUrl, description, type, region, seasons, episodes, tmdbId
        );

        movies.add(movie);
        saveToFile();
        return movie;
    }

    public Movie findByTmdbId(int tmdbId, String type) {
        if (tmdbId <= 0) return null;

        for (Movie movie : movies) {
            if (movie.getTmdbId() == tmdbId
                    && movie.getType().equalsIgnoreCase(type)) {
                return movie;
            }
        }

        return null;
    }

    public boolean deleteMovie(int id) {
        boolean deleted = movies.removeIf(movie -> movie.getId() == id);

        if (deleted) {
            saveToFile();
        }

        return deleted;
    }

    public Movie findMovie(int id) {
        for (Movie movie : movies) {
            if (movie.getId() == id) return movie;
        }

        return null;
    }

    public void save() {
        saveToFile();
    }

    public List<Movie> getMovies() {
        return movies;
    }

    public int getTotalMovies() {
        return movies.size();
    }

    public int getWatchedMovies() {
        int count = 0;

        for (Movie movie : movies) {
            if (movie.isWatched()) {
                count++;
            }
        }

        return count;
    }

    public int getUnwatchedMovies() {
        return getTotalMovies() - getWatchedMovies();
    }

    public double getAverageRating() {
        if (movies.isEmpty()) return 0;

        double total = 0;

        for (Movie movie : movies) {
            total += movie.getRating();
        }

        return total / movies.size();
    }

    // =========================================================
    // FILE PERSISTENCE
    // =========================================================

    private void loadFromFile() {

        try {
            Files.createDirectories(DATA_FILE.getParent());

            if (!Files.exists(DATA_FILE)) {
                Files.createFile(DATA_FILE);
                return;
            }

            List<String> lines = Files.readAllLines(DATA_FILE, StandardCharsets.UTF_8);

            int highestId = 0;

            for (String line : lines) {

                if (line == null || line.isBlank()) {
                    continue;
                }

                try {
                    String[] parts = line.split("\\|", -1);

                    if (parts.length != 13) {
                        continue;
                    }

                    int id = Integer.parseInt(parts[0]);
                    String title = decode(parts[1]);
                    String genre = decode(parts[2]);
                    int year = Integer.parseInt(parts[3]);
                    double rating = Double.parseDouble(parts[4]);
                    boolean watched = Boolean.parseBoolean(parts[5]);
                    boolean favorite = Boolean.parseBoolean(parts[6]);
                    String imageUrl = decode(parts[7]);
                    String description = decode(parts[8]);
                    String type = decode(parts[9]);
                    String region = decode(parts[10]);
                    int seasons = Integer.parseInt(parts[11]);
                    int episodes = Integer.parseInt(parts[12]);

                    // tmdbId is stored together with the ID using a final field
                    // in the next column for backward-safe parsing.
                    // This branch is retained below for the 14-field format.
                } catch (Exception ignored) {
                    // Ignore a damaged line and continue loading other titles.
                }
            }

            // Re-read using the current 14-field format.
            movies.clear();
            highestId = 0;

            for (String line : lines) {

                if (line == null || line.isBlank()) {
                    continue;
                }

                try {
                    String[] parts = line.split("\\|", -1);

                    if (parts.length != 14) {
                        continue;
                    }

                    int id = Integer.parseInt(parts[0]);
                    String title = decode(parts[1]);
                    String genre = decode(parts[2]);
                    int year = Integer.parseInt(parts[3]);
                    double rating = Double.parseDouble(parts[4]);
                    boolean watched = Boolean.parseBoolean(parts[5]);
                    boolean favorite = Boolean.parseBoolean(parts[6]);
                    String imageUrl = decode(parts[7]);
                    String description = decode(parts[8]);
                    String type = decode(parts[9]);
                    String region = decode(parts[10]);
                    int seasons = Integer.parseInt(parts[11]);
                    int episodes = Integer.parseInt(parts[12]);
                    int tmdbId = Integer.parseInt(parts[13]);

                    Movie movie = new Movie(
                            id, title, genre, year, rating,
                            watched, favorite, imageUrl, description,
                            type, region, seasons, episodes, tmdbId
                    );

                    movies.add(movie);
                    highestId = Math.max(highestId, id);

                } catch (Exception ignored) {
                    // Ignore a damaged line and continue loading other titles.
                }
            }

            nextId = highestId + 1;

        } catch (IOException e) {
            System.err.println("Could not load saved watchlist: " + e.getMessage());
        }
    }

    private void saveToFile() {

        try {
            Files.createDirectories(DATA_FILE.getParent());

            Path tempFile = Paths.get("data", "watchlist.tmp");

            List<String> lines = new ArrayList<>();

            for (Movie movie : movies) {

                String line =
                        movie.getId() + "|" +
                        encode(movie.getTitle()) + "|" +
                        encode(movie.getGenre()) + "|" +
                        movie.getYear() + "|" +
                        movie.getRating() + "|" +
                        movie.isWatched() + "|" +
                        movie.isFavorite() + "|" +
                        encode(movie.getImageUrl()) + "|" +
                        encode(movie.getDescription()) + "|" +
                        encode(movie.getType()) + "|" +
                        encode(movie.getRegion()) + "|" +
                        movie.getSeasons() + "|" +
                        movie.getEpisodes() + "|" +
                        movie.getTmdbId();

                lines.add(line);
            }

            Files.write(
                    tempFile,
                    lines,
                    StandardCharsets.UTF_8
            );

            try {
                Files.move(
                        tempFile,
                        DATA_FILE,
                        StandardCopyOption.REPLACE_EXISTING,
                        StandardCopyOption.ATOMIC_MOVE
                );
            } catch (AtomicMoveNotSupportedException e) {
                Files.move(
                        tempFile,
                        DATA_FILE,
                        StandardCopyOption.REPLACE_EXISTING
                );
            }

        } catch (IOException e) {
            System.err.println("Could not save watchlist: " + e.getMessage());
        }
    }

    private static String encode(String value) {
        if (value == null) value = "";

        return Base64.getEncoder().encodeToString(
                value.getBytes(StandardCharsets.UTF_8)
        );
    }

    private static String decode(String value) {
        if (value == null || value.isEmpty()) return "";

        return new String(
                Base64.getDecoder().decode(value),
                StandardCharsets.UTF_8
        );
    }
}
