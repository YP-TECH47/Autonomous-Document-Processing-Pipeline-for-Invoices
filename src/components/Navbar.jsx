import React, { useState, useEffect, useRef } from "react";
import { FaSignOutAlt, FaUser } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import supabase from "../supabaseClient"; // Import Supabase client
import logo from "/IMG_1248.png";

const Navbar = () => {
  const [user, setUser] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  
  // Fetch user data from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser.name) {
          setUser(parsedUser);
        } else {
          fetchUserName(parsedUser.id); // Fetch name if missing
        }
      } catch (error) {
        console.error("Error parsing user data:", error);
      }
    }
  }, []);

  // Fetch user name from Supabase if missing in localStorage
  const fetchUserName = async (userId) => {
    if (!userId) return;
    const { data, error } = await supabase
      .from("users")
      .select("name")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching user name:", error);
      return;
    }

    if (data && data.name) {
      const updatedUser = { ...JSON.parse(localStorage.getItem("user")), name: data.name };
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  
  // Generate initials from the user's name
  const getInitials = () => {
    if (!user || !user.name) return "UN"; // Default initials
    return user.name.substring(0, 2).toUpperCase();
  };
  
  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div className="fixed top-4 left-[290px] right-4 bg-white shadow-lg rounded-lg p-4 h-16 flex justify-between items-center z-20">
      <div className="flex items-center space-x-4">
        <img src={logo} alt="Logo" className="h-20 w-auto" />
      </div>
      <div className="flex items-center space-x-6">
        <select className="border border-gray-200 rounded-md px-3 py-1.5 outline-none">
          <option>English</option>
        </select>
        <div className="relative" ref={dropdownRef}>
          <div 
            className="flex items-center space-x-3 cursor-pointer"
            onClick={() => setShowDropdown(!showDropdown)}
          >
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <span className="text-white text-sm">{getInitials()}</span>
            </div>
            <span className="text-sm font-medium">{user?.name || "User"}</span>
          </div>
          
          {showDropdown && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg py-2 z-50 border border-gray-200">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name || "User"}</p>
                <p className="text-xs text-gray-500 mt-1">@{user?.username || "username"}</p>
              </div>
              <div className="px-4 py-2 text-sm text-gray-700">
                <div className="flex items-center space-x-2 my-2">
                  <FaUser className="text-gray-400" />
                  <span>User ID: {user?.id ? user.id.substring(0, 8) + "..." : "N/A"}</span>
                </div>
              </div>
              <div 
                className="flex items-center px-4 py-2 text-sm text-red-600 hover:bg-red-50 cursor-pointer"
                onClick={handleLogout}
              >
                <FaSignOutAlt className="mr-2" />
                Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Navbar;