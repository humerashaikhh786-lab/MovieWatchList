import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;

public class Watchlist {

    private final List<Movie> movies = new ArrayList<>();
    private int nextId = 1;

    public Watchlist() {
        loadFromDatabase();
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

            save();
            return existing;
        }

        Movie movie = new Movie(
                nextId++,
                title,
                genre,
                year,
                rating,
                watched,
                favorite,
                imageUrl,
                description,
                type,
                region,
                seasons,
                episodes,
                tmdbId
        );

        String sql = """
            INSERT INTO watchlist
            (id, title, genre, year, rating, watched, favorite, image_url,
             description, type, region, seasons, episodes, tmdb_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setInt(1, movie.getId());
            statement.setString(2, movie.getTitle());
            statement.setString(3, movie.getGenre());
            statement.setInt(4, movie.getYear());
            statement.setDouble(5, movie.getRating());
            statement.setBoolean(6, movie.isWatched());
            statement.setBoolean(7, movie.isFavorite());
            statement.setString(8, movie.getImageUrl());
            statement.setString(9, movie.getDescription());
            statement.setString(10, movie.getType());
            statement.setString(11, movie.getRegion());
            statement.setInt(12, movie.getSeasons());
            statement.setInt(13, movie.getEpisodes());
            statement.setInt(14, movie.getTmdbId());

            statement.executeUpdate();
            movies.add(movie);

            return movie;

        } catch (Exception e) {
            nextId--;
            System.err.println("Could not add movie to database: " + e.getMessage());
            return null;
        }
    }

    public Movie findByTmdbId(int tmdbId, String type) {
        if (tmdbId <= 0 || type == null) return null;

        for (Movie movie : movies) {
            if (movie.getTmdbId() == tmdbId
                    && movie.getType().equalsIgnoreCase(type)) {
                return movie;
            }
        }

        return null;
    }

    public boolean deleteMovie(int id) {

        Movie movie = findMovie(id);

        if (movie == null) {
            return false;
        }

        String sql = "DELETE FROM watchlist WHERE id = ?";

        try (Connection connection = Database.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            statement.setInt(1, id);

            int affected = statement.executeUpdate();

            if (affected > 0) {
                movies.remove(movie);
                return true;
            }

        } catch (Exception e) {
            System.err.println("Could not delete movie from database: " + e.getMessage());
        }

        return false;
    }

    public Movie findMovie(int id) {
        for (Movie movie : movies) {
            if (movie.getId() == id) {
                return movie;
            }
        }

        return null;
    }

    public void save() {

        String sql = """
            UPDATE watchlist
            SET title = ?,
                genre = ?,
                year = ?,
                rating = ?,
                watched = ?,
                favorite = ?,
                image_url = ?,
                description = ?,
                type = ?,
                region = ?,
                seasons = ?,
                episodes = ?,
                tmdb_id = ?
            WHERE id = ?
            """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql)) {

            for (Movie movie : movies) {

                statement.setString(1, movie.getTitle());
                statement.setString(2, movie.getGenre());
                statement.setInt(3, movie.getYear());
                statement.setDouble(4, movie.getRating());
                statement.setBoolean(5, movie.isWatched());
                statement.setBoolean(6, movie.isFavorite());
                statement.setString(7, movie.getImageUrl());
                statement.setString(8, movie.getDescription());
                statement.setString(9, movie.getType());
                statement.setString(10, movie.getRegion());
                statement.setInt(11, movie.getSeasons());
                statement.setInt(12, movie.getEpisodes());
                statement.setInt(13, movie.getTmdbId());
                statement.setInt(14, movie.getId());

                statement.addBatch();
            }

            statement.executeBatch();

        } catch (Exception e) {
            System.err.println("Could not save watchlist to database: " + e.getMessage());
        }
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
        if (movies.isEmpty()) {
            return 0;
        }

        double total = 0;

        for (Movie movie : movies) {
            total += movie.getRating();
        }

        return total / movies.size();
    }

    // =========================================================
    // MYSQL PERSISTENCE
    // =========================================================

    private void loadFromDatabase() {

        String sql = """
            SELECT id, title, genre, year, rating, watched, favorite,
                   image_url, description, type, region, seasons,
                   episodes, tmdb_id
            FROM watchlist
            ORDER BY id
            """;

        try (Connection connection = Database.getConnection();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet result = statement.executeQuery()) {

            movies.clear();

            int highestId = 0;

            while (result.next()) {

                int id = result.getInt("id");

                Movie movie = new Movie(
                        id,
                        result.getString("title"),
                        result.getString("genre"),
                        result.getInt("year"),
                        result.getDouble("rating"),
                        result.getBoolean("watched"),
                        result.getBoolean("favorite"),
                        result.getString("image_url"),
                        result.getString("description"),
                        result.getString("type"),
                        result.getString("region"),
                        result.getInt("seasons"),
                        result.getInt("episodes"),
                        result.getInt("tmdb_id")
                );

                movies.add(movie);
                highestId = Math.max(highestId, id);
            }

            nextId = highestId + 1;

            System.out.println(
                    "Watchlist loaded from MySQL: " + movies.size() + " records"
            );

        } catch (Exception e) {
            System.err.println(
                    "Could not load watchlist from database: " + e.getMessage()
            );
        }
    }
}
