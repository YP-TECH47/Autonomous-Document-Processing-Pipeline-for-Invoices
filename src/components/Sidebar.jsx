import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, FileText, AlertTriangle, Package, IndianRupee } from "lucide-react";

const Sidebar = () => {
  const location = useLocation();
  
  const isActive = (path) => {
    if (path === "/dashboard") {
      return location.pathname === path || location.pathname === "/";
    }
    return location.pathname === path;
  };

  return (
    <div className="fixed top-4 left-4 w-[260px] h-[calc(100vh-32px)] bg-white shadow-lg rounded-lg p-6 z-10">
      <div className="mb-6">
        <h2 className="text-lg font-semibold">MAIN MENU</h2>
      </div>
      <Link 
        to="/dashboard" 
        className={`flex items-center px-4 py-2 rounded-md transition-colors ${
          isActive("/dashboard") ? "bg-purple-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        <Home className="w-5 h-5 mr-2" />
        Dashboard
      </Link>
      <Link
        to="/invoices-archive"
        className={`flex items-center px-4 py-2 mt-4 rounded-md transition-colors ${
          isActive("/invoices-archive") ? "bg-purple-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        <FileText className="w-5 h-5 mr-2" />
        Invoices Archive
      </Link>
      <Link
        to="/flagged-review"
        className={`flex items-center px-4 py-2 mt-4 rounded-md transition-colors ${
          isActive("/flagged-review") ? "bg-purple-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        <AlertTriangle className="w-5 h-5 mr-2" />
        Flagged for Review
      </Link>
      <Link
        to="/purchase-order"
        className={`flex items-center px-4 py-2 mt-4 rounded-md transition-colors ${
          isActive("/purchase-order") ? "bg-purple-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        <Package className="w-5 h-5 mr-2" />
        Purchase Order
      </Link>
      <Link
        to="/accounts-payable"
        className={`flex items-center px-4 py-2 mt-4 rounded-md transition-colors ${
          isActive("/accounts-payable") ? "bg-purple-600 text-white" : "hover:bg-gray-100"
        }`}
      >
        <IndianRupee className="w-5 h-5 mr-2" />
        Accounts Payable
      </Link>
    </div>
  );
};

export default Sidebar;