import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public class Database {
    private static final String HOST = System.getenv("MOVIEWATCHLIST_DB_HOST");
    private static final String PORT = System.getenv().getOrDefault("MOVIEWATCHLIST_DB_PORT", "4000");
    private static final String NAME = System.getenv().getOrDefault("MOVIEWATCHLIST_DB_NAME", "moviewatchlist");
    private static final String USER = System.getenv("MOVIEWATCHLIST_DB_USER");
    private static final String PASSWORD = System.getenv("MOVIEWATCHLIST_DB_PASSWORD");

    public static Connection getConnection() throws SQLException {
        if (HOST == null || HOST.isBlank()) {
            throw new SQLException("MOVIEWATCHLIST_DB_HOST environment variable is not set.");
        }

        if (USER == null || USER.isBlank()) {
            throw new SQLException("MOVIEWATCHLIST_DB_USER environment variable is not set.");
        }

        if (PASSWORD == null || PASSWORD.isBlank()) {
            throw new SQLException("MOVIEWATCHLIST_DB_PASSWORD environment variable is not set.");
        }

        String url = "jdbc:mysql://" + HOST + ":" + PORT + "/" + NAME
                + "?sslMode=VERIFY_IDENTITY";

        return DriverManager.getConnection(url, USER, PASSWORD);
    }
}
