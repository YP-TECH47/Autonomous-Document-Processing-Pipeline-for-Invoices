import React from "react";
import { Search } from "lucide-react"; // Import search icon

const SearchBar = ({ onSearch }) => {
  return (
    <div className="flex justify-center mt-4">
      <div className="relative w-full md:w-1/2">
        <input
          type="text"
          onChange={(e) => onSearch(e.target.value)} // ✅ Sends search query to parent
          placeholder="Search by Invoice ID or Vendor Name..."
          className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
        />
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500" />
      </div>
    </div>
  );
};

export default SearchBar;