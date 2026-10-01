import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import { Analytics } from "@vercel/analytics/react";
import InvoicesArchive from "./pages/InvoicesArchive";
import FlaggedForReview from "./pages/FlaggedForReview";
import PurchaseOrders from "./pages/PurchaseOrders";
import Login from "./pages/Login";
import AccountsPayable from "./pages/AccountsPayable";

// Loading Spinner Component
const LoadingSpinner = () => (
  <div className="fixed inset-0 flex items-center justify-center z-50">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
  </div>
);

// Higher-order component for pages with loading
const withLoading = (Component) => () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  return <>{isLoading ? <LoadingSpinner /> : <Component />}</>;
};

const DashboardWithLoading = withLoading(Dashboard);
const InvoicesArchiveWithLoading = withLoading(InvoicesArchive);
const FlaggedForReviewWithLoading = withLoading(FlaggedForReview);
const PurchaseOrdersWithLoading = withLoading(PurchaseOrders);
const AccountsPayableWithLoading = withLoading(AccountsPayable);
const LoginWithLoading = withLoading(Login);

// Protected route component
const ProtectedRoute = ({ children }) => {
  let user = null;
  try {
    user = JSON.parse(localStorage.getItem("user") || "null");
  } catch (error) {
    console.error("Error parsing user from localStorage:", error);
  }
  return user ? children : <Navigate to="/login" replace />;
};

const App = () => {
  const [isLargeScreen, setIsLargeScreen] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const checkScreenSize = () => setIsLargeScreen(window.innerWidth >= 1024);
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  if (!isLargeScreen) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-blue-500 to-purple-600 z-50 flex items-center justify-center p-4">
        <div className="bg-white/20 backdrop-blur-lg rounded-2xl border border-white/30 shadow-2xl max-w-md w-full p-8 text-center transform transition-all hover:scale-105">
          <h2 className="text-3xl font-bold text-white mb-4">Large Screen Required</h2>
          <p className="text-white/80 text-lg mb-6">The prototype is compatible with large screen sizes.</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginWithLoading />} />
        <Route path="/dashboard" element={<ProtectedRoute><DashboardWithLoading /></ProtectedRoute>} />
        <Route path="/invoices-archive" element={<ProtectedRoute><InvoicesArchiveWithLoading /></ProtectedRoute>} />
        <Route path="/flagged-review" element={<ProtectedRoute><FlaggedForReviewWithLoading /></ProtectedRoute>} />
        <Route path="/purchase-order" element={<ProtectedRoute><PurchaseOrdersWithLoading /></ProtectedRoute>} />
        <Route path="/accounts-payable" element={<ProtectedRoute><AccountsPayableWithLoading /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/login" replace />} />
      </Routes>
      <Analytics />
    </Router>
  );
};

export default App;
