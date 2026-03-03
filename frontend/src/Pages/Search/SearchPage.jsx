
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { SERVER_URL } from '../../config';
import Avatar from '../../Components/Common/Avatar';

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const EmptyStateIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z" />
  </svg>
);

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const performSearch = useCallback(async (currentQuery) => {
    if (!currentQuery.trim()) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${SERVER_URL}/api/users/search?q=${currentQuery}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Failed to fetch search results.');

      const data = await response.json();
      setResults(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [query, performSearch]);

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 font-sans">
      <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg border border-gray-100">
        <h1 className="text-3xl font-bold mb-1 text-gray-800">Find People</h1>
        <p className="text-gray-500 mb-6">
          Look up friends by <span className="font-semibold text-gray-700">username only</span>. Display names appear alongside results for easy identification.
        </p>

        <div className="relative mb-3">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username (e.g. johndoe)"
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Tip: Searching works with usernames only. Try the exact username if you don't see who you're looking for.
        </p>

        {error && <p className="text-red-500 text-center mb-4">{error}</p>}

        <div className="space-y-3 min-h-[220px] flex flex-col">
          {isLoading ? (
            <p className="text-gray-500 text-center m-auto">Searching...</p>
          ) : results.length > 0 ? (
            results.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 transition-colors"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <Avatar user={user} size="w-12 h-12" />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{user.display_name || user.username}</p>
                    <p className="text-sm text-gray-500 truncate">@{user.username}</p>
                  </div>
                </div>
                <Link
                  to={`/profile/${user.username}`}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 text-sm rounded-md font-semibold shrink-0"
                >
                  View Profile
                </Link>
              </div>
            ))
          ) : (
            <div className="text-center m-auto text-gray-500">
              <EmptyStateIcon />
              <p className="mt-4 font-semibold">
                {hasSearched ? 'No users found.' : 'Search for users to get started.'}
              </p>
              <p className="text-sm">
                {hasSearched ? `We couldn't find the username "${query}".` : 'Your search results will appear here.'}
              </p>
              {hasSearched && (
                <p className="text-xs text-gray-400 mt-2">Remember: searching works with usernames only.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
