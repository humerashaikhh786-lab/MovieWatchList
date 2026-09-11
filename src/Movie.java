public class Movie {

    private int id;
    private String title;
    private String genre;
    private int year;
    private double rating;
    private boolean watched;
    private boolean favorite;
    private String imageUrl;
    private String description;
    private String type;
    private String region;
    private int seasons;
    private int episodes;
    private int tmdbId;

    public Movie(int id, String title, String genre, int year, double rating,
                 boolean watched, boolean favorite, String imageUrl, String description,
                 String type, String region, int seasons, int episodes, int tmdbId) {
        this.id = id;
        this.title = title;
        this.genre = genre;
        this.year = year;
        this.rating = rating;
        this.watched = watched;
        this.favorite = favorite;
        this.imageUrl = imageUrl;
        this.description = description;
        this.type = type;
        this.region = region;
        this.seasons = seasons;
        this.episodes = episodes;
        this.tmdbId = tmdbId;
    }

    public int getId() { return id; }
    public String getTitle() { return title; }
    public String getGenre() { return genre; }
    public int getYear() { return year; }
    public double getRating() { return rating; }
    public boolean isWatched() { return watched; }
    public boolean isFavorite() { return favorite; }
    public String getImageUrl() { return imageUrl; }
    public String getDescription() { return description; }
    public String getType() { return type; }
    public String getRegion() { return region; }
    public int getSeasons() { return seasons; }
    public int getEpisodes() { return episodes; }
    public int getTmdbId() { return tmdbId; }

    public void setTitle(String title) { this.title = title; }
    public void setGenre(String genre) { this.genre = genre; }
    public void setYear(int year) { this.year = year; }
    public void setRating(double rating) { this.rating = rating; }
    public void setWatched(boolean watched) { this.watched = watched; }
    public void setFavorite(boolean favorite) { this.favorite = favorite; }
    public void setImageUrl(String imageUrl) { this.imageUrl = imageUrl; }
    public void setDescription(String description) { this.description = description; }
    public void setType(String type) { this.type = type; }
    public void setRegion(String region) { this.region = region; }
    public void setSeasons(int seasons) { this.seasons = seasons; }
    public void setEpisodes(int episodes) { this.episodes = episodes; }
    public void setTmdbId(int tmdbId) { this.tmdbId = tmdbId; }
}
