import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FaLock, FaUser } from "react-icons/fa";
import supabase from "../supabaseClient"; // Updated import to match your file

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const usernameInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    usernameInputRef.current?.focus();
  }, []);

  const handleUsernameChange = (e) => {
    setUsername(e.target.value);
    setLoginError("");
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    setLoginError("");
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    
    if (!username || !password) {
      setLoginError("Please enter both username and password");
      return;
    }

    setIsLoading(true);
    
    try {
      // Query the users table in Supabase
      // const { data, error } = await supabase
      //   .from("users")
      //   .select("*")
      //   .eq("username", username)
      //   .single();

      const data = {
        id: 1,
        username: "Yash Panjwani",
        name: "Test User",
        password_hash: "password" // Mock password hash for testing
      }; // Mock data for testing
      const error = null; // Mock error for testing

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      if (!data) {
        setLoginError("User not found");
        setIsLoading(false);
        return;
      }

      // Compare the provided password with the stored password_hash
      if (data.password_hash === "password") {
        // Store user info in localStorage
        localStorage.setItem("user", JSON.stringify({
          id: data.id,
          username: data.username,
          name: data.name
        }));
        
        // Redirect to Dashboard
        navigate("/dashboard");
      } else {
        setLoginError("Invalid password");
      }
    } catch (error) {
      console.error("Login error:", error);
      setLoginError("An error occurred during login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F2F2F2] px-4">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-md">
        <div className="flex justify-center mb-6">
          <div className="p-3 bg-blue-100 rounded-full">
            <FaLock size={24} className="text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
          Secure Invoice Archive
        </h2>
        <form onSubmit={handleLoginSubmit} autoComplete="off">
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="username">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FaUser className="text-gray-400" />
              </div>
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                ref={usernameInputRef}
                className="w-full pl-10 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter username"
                required
              />
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={handlePasswordChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter password"
              required
            />
          </div>
          {loginError && (
            <p className="text-red-500 text-sm mb-4">{loginError}</p>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full py-2 px-4 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isLoading ? "opacity-70 cursor-not-allowed" : ""
            }`}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
       
      </div>
    </div>
  );
};

export default Login;