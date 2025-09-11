import React, { useState, useEffect } from 'react';
import { Search, X, Zap } from 'lucide-react';

const API_KEY = 'AIzaSyAuITNIxi7_fxssgpsmgOWGJ8RVigPZGFc'; // Replace with your actual Tenor API key

const GifPicker = ({ isDark, onGifSelect, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showTrending, setShowTrending] = useState(true);

  const fetchTrendingGifs = async () => {
    setIsSearching(true);
    setShowTrending(true);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/featured?key=${API_KEY}&limit=20`
      );
      const data = await response.json();
      setSearchResults(data.results.map(gif => ({ 
        id: gif.id, 
        url: gif.media_formats.gif.url,
        previewUrl: gif.media_formats.tinygif?.url || gif.media_formats.gif.url,
        title: gif.content_description || 'GIF'
      })));
    } catch (error) {
      console.error('Error fetching trending GIFs:', error);
    } finally {
      setIsSearching(false);
    }
  };

  const searchGifs = async (query) => {
    if (!query.trim()) {
      fetchTrendingGifs();
      return;
    }

    setIsSearching(true);
    setShowTrending(false);
    try {
      const response = await fetch(
        `https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${API_KEY}&limit=20`
      );
      const data = await response.json();
      setSearchResults(data.results.map(gif => ({ 
        id: gif.id, 
        url: gif.media_formats.gif.url,
        previewUrl: gif.media_formats.tinygif?.url || gif.media_formats.gif.url,
        title: gif.content_description || 'GIF'
      })));
    } catch (error) {
      console.error('Error searching GIFs:', error);
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchGifs(searchTerm);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  useEffect(() => {
    fetchTrendingGifs();
  }, []);

  const handleGifClick = (gif) => {
    // Send the GIF URL directly as content - this will be treated as a text message with GIF content
    onGifSelect({
      url: gif.url,
      title: gif.title || 'animated-gif', // Better default title
      content: gif.url // This will be the message content
    });
  };

  return (
    <div className={`absolute bottom-12 right-0 w-80 h-96 rounded-lg shadow-lg border z-20 ${
      isDark ? 'bg-gray-800 border-gray-600' : 'bg-white border-gray-200'
    }`}>
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">GIFs</h3>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search GIFs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 rounded-lg border text-sm ${
              isDark 
                ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                : 'bg-gray-50 border-gray-300 placeholder-gray-500'
            } focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
          />
        </div>
      </div>

      {/* Content */}
      <div className="p-2 h-80 overflow-y-auto">
        {/* Trending/Search Header */}
        <div className="flex items-center space-x-2 mb-2 px-1">
          <Zap className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-medium">
            {showTrending ? 'Trending' : `Results for "${searchTerm}"`}
          </span>
        </div>

        {/* Loading State */}
        {isSearching && (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {/* No Results */}
        {!isSearching && !showTrending && searchResults.length === 0 && searchTerm && (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Search className="w-8 h-8 mb-2" />
            <p className="text-sm">No GIFs found</p>
            <p className="text-xs">Try a different search term</p>
          </div>
        )}

        {/* GIF Grid */}
        {!isSearching && searchResults.length > 0 && (
          <div className="grid grid-cols-2 gap-2">
            {searchResults.map((gif) => (
              <div
                key={gif.id}
                onClick={() => handleGifClick(gif)}
                className="relative cursor-pointer rounded-lg overflow-hidden hover:opacity-80 transition-opacity group"
              >
                <img
                  src={gif.previewUrl}
                  alt={gif.title}
                  className="w-full h-24 object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // Fallback to main GIF URL if preview fails
                    e.target.src = gif.url;
                  }}
                />
                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all"></div>
                <div className="absolute bottom-1 left-1 right-1">
                  <p className="text-xs text-white bg-black bg-opacity-50 rounded px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                    {gif.title}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 text-center">
          Powered by Tenor
        </p>
      </div>
    </div>
  );
};

export default GifPicker;