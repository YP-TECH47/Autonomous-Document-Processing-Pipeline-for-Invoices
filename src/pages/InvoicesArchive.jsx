import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import FilterCard from "../components/FilterCard";
import TableComponent from "../components/TableComponent";
import SearchBar from "../components/SearchBar";
import { FaTimes, FaLock } from "react-icons/fa";
import supabase from "../supabaseClient";

const InvoicesArchive = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [rawData, setRawData] = useState({ invoices: [], vendors: [] });
  const [selectedPdf, setSelectedPdf] = useState(null);
  
  // Authentication states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Correct password - in a real application, this would be handled securely on the server
  const CORRECT_PASSWORD = "invoice2025"; // This should be stored securely in production

  // Handle password change
  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  // Handle password submission
  const handlePasswordSubmit = (e) => {
    e.preventDefault();
    setIsLoading(true);
    setPasswordError("");
    
    // Simulate server verification with a slight delay
    setTimeout(() => {
      if (password === CORRECT_PASSWORD) {
        setIsAuthenticated(true);
      } else {
        setPasswordError("Incorrect password. Please try again.");
      }
      setIsLoading(false);
    }, 800);
  };

  // ✅ Fetch raw data (Invoices + Vendors)
  const fetchDetails = async () => {
  if (!isAuthenticated) return;

  try {
    // ✅ Fetch invoices, including urgency column
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(
        "order_id, invoice_no, order_date, total_amount, cgst_amount, sgst_amount, igst_amount, vendor_id, pdf_url, urgency, payment_status"
      );

    // ✅ Fetch vendors for vendor_name & gstin
    const { data: vendors, error: vendorsError } = await supabase
      .from("vendors_db")
      .select("vendor_id, vendor_name, gstin");

    if (invoicesError) console.error("Error fetching invoices:", invoicesError);
    if (vendorsError) console.error("Error fetching vendors:", vendorsError);

    setRawData({ invoices: invoices || [], vendors: vendors || [] });
  } catch (err) {
    console.error("Unexpected error while fetching data:", err);
  }
};

  // ✅ Process and merge data
  // ✅ Process and merge data
const generateTableData = () => {
  const { invoices, vendors } = rawData;
  // ✅ Create a lookup for vendor_name and gstin
  const vendorMap = {};
  vendors.forEach((vendor) => {
    vendorMap[vendor.vendor_id] = {
      vendor_name: vendor.vendor_name,
      gstin: vendor.gstin,
    };
  });

  const processedData = invoices.map((invoice) => ({
    order_id: invoice.order_id,
    invoice_no: invoice.invoice_no,
    order_date: invoice.order_date,
    total_amount: invoice.total_amount ? `₹${invoice.total_amount}` : "N/A",
    cgst_amount: invoice.cgst_amount ? `₹${invoice.cgst_amount}` : "N/A",
    sgst_amount: invoice.sgst_amount ? `₹${invoice.sgst_amount}` : "N/A",
    igst_amount: invoice.igst_amount ? `₹${invoice.igst_amount}` : "N/A",
    vendor_name: vendorMap[invoice.vendor_id]?.vendor_name || "Unknown Vendor",
    gstin: vendorMap[invoice.vendor_id]?.gstin || "N/A",
    pdf_url: invoice.pdf_url || null, // Keep the original pdf_url field
    urgency: invoice.urgency, // ✅ Include urgency from database
    payment_status:invoice.payment_status,
  }));
  
  // Sort processedData by order_date (newest to oldest)
  return processedData.sort((a, b) => {
    const dateA = new Date(a.order_date);
    const dateB = new Date(b.order_date);
    return dateB - dateA; // For descending order (newest first)
    // Use return dateA - dateB; for ascending order (oldest first)
  });
};

  // ✅ Fetch data when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log("Fetching invoice details...");
      fetchDetails();
    }
  }, [isAuthenticated]);

  // ✅ Process data when rawData updates
  useEffect(() => {
    if (rawData.invoices.length) {
      const processedData = generateTableData();
      console.log("Processed Data:", processedData);
      setTableData(processedData);
      setFilteredData(processedData);
    }
  }, [rawData]);

  // ✅ Apply Filters
  const handleApplyFilters = ({
    minBalance,
    maxBalance,
    startDate,
    endDate,
  }) => {
    let filtered = [...tableData];

    if (minBalance) {
      filtered = filtered.filter(
        (item) => parseFloat(item.total_amount.replace("₹", "")) >= minBalance
      );
    }
    if (maxBalance) {
      filtered = filtered.filter(
        (item) => parseFloat(item.total_amount.replace("₹", "")) <= maxBalance
      );
    }
    if (startDate && endDate) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.order_date);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
      });
    }

    setFilteredData(filtered);
  };

  // ✅ Reset Filters
  const handleResetFilters = () => {
    setFilteredData(tableData);
  };

  // ✅ Apply Search
  const searchFilteredData = filteredData.filter((invoice) => {
    if (!searchQuery) return true;
    const lowerSearch = searchQuery.toLowerCase();
    return (
      String(invoice.order_id).toLowerCase().includes(lowerSearch) ||
      String(invoice.invoice_no).toLowerCase().includes(lowerSearch) ||
      (invoice.vendor_name &&
        invoice.vendor_name.toLowerCase().includes(lowerSearch))
    );
  });

  // ✅ Handler for PDF button click
  const handlePdfClick = (pdfUrl) => {
    setSelectedPdf(pdfUrl);
  };

  // Function to close the PDF viewer
  const closePdfViewer = () => {
    setSelectedPdf(null);
  };

  // Login form component
  const LoginForm = () => {
    // Use useRef to maintain reference to the input element
    const passwordInputRef = React.useRef(null);
    
    // Focus the input field when component mounts
    React.useEffect(() => {
      if (passwordInputRef.current) {
        passwordInputRef.current.focus();
      }
    }, []);
    
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
          <form onSubmit={handlePasswordSubmit} autoComplete="off">
            <div className="mb-4">
              <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">
                Enter Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={handlePasswordChange}
                ref={passwordInputRef}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter access password"
                required
                autoComplete="new-password"
              />
              {passwordError && (
                <p className="text-red-500 text-sm mt-2">{passwordError}</p>
              )}
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className={`w-full py-2 px-4 rounded-md font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                isLoading ? "opacity-70 cursor-not-allowed" : ""
              }`}
            >
              {isLoading ? "Verifying..." : "Access Invoices"}
            </button>
          </form>
          <p className="mt-6 text-sm text-center text-gray-600">
            This page contains confidential financial information.
            <br />
            Authorized personnel only.
          </p>
        </div>
      </div>
    );
  };

  if (!isAuthenticated) {
    return <LoginForm />;
  }

  return (
    <div className="min-h-screen bg-[#F2F2F2] relative">
      <Navbar />
      <Sidebar />

      <main className="ml-[280px] pt-24 px-6">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-serif font-bold text-gray-800">
            Invoices Archive
          </h1>
        </div>

        {/* Pass tableData to FilterCard for download functionality */}
        <FilterCard
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          tableData={searchFilteredData}
        />

        {/* ✅ SearchBar now updates `searchQuery` */}
        <SearchBar onSearch={setSearchQuery} />

        {/* ✅ Pass the filtered & searched data to TableComponent */}
        <TableComponent
          title="Invoices Archive"
          columns={[
            { key: "order_id", label: "Order ID" },
            { key: "invoice_no", label: "Invoice No" },
            { key: "vendor_name", label: "Vendor Name" },
            { key: "gstin", label: "GSTIN" },
            { key: "order_date", label: "Order Date" },
            {
              key: "urgency",
              label: "Urgency",
              render: (row) => {
                let urgencyColor = "bg-green-100 text-green-700 border border-green-400"; // Default: No Urgency (Green)
                let urgencyText = "No Urgency"; // Default text
            
                if (row.urgency !== null) {
                  const urgencyValue = parseInt(row.urgency, 10);
            
                  if (urgencyValue === 0) {
                    urgencyText = "No Urgency";
                  } else {
                    urgencyText = `${urgencyValue} days`;
                    if (urgencyValue < 10) {
                      urgencyColor = "bg-red-100 text-red-700 border border-red-400"; // High urgency (Red)
                    } else {
                      urgencyColor = "bg-yellow-100 text-yellow-700 border border-yellow-400"; // Medium urgency (Yellow)
                    }
                  }
                }
            
                return (
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${urgencyColor} shadow-sm`}>
                    {urgencyText}
                  </span>
                );
              },
            },
            { key: "total_amount", label: "Total Amount" },
            { key: "cgst_amount", label: "CGST Amount" },
            { key: "sgst_amount", label: "SGST Amount" },
            { key: "igst_amount", label: "IGST Amount" },
            { key: "total_amount", label: "Total Amount" },
            { key: "pdf_url", label: "Invoice PDF" },
            {
              key: "payment_status",
              label: "Payment Status",
              render: (row) => {  // Accept the entire row object
                const status = row.payment_status; // Extract the payment_status field
            
                let statusColor = "bg-gray-100 text-gray-800 border border-gray-300"; 
                let statusText = status || "Unknown"; 
            
                if (status === "Paid") {
                  statusColor = "bg-green-100 text-green-700 border border-green-400";
                } else if (status === "Pending") {
                  statusColor = "bg-yellow-100 text-red-700 border border-yellow-400";
                } else if (status === "Overdue") {
                  statusColor = "bg-red-100 text-red-700 border border-red-400";
                }
            
                return (
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusColor} shadow-sm`}>
                    {statusText}
                  </span>
                );
              },
            },
          ]}
          data={searchFilteredData}
          onPdfClick={handlePdfClick}
        />
      </main>

      {/* PDF Viewer Modal */}
      {selectedPdf && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-5xl h-5/6 flex flex-col">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Invoice PDF</h2>
              <button
                onClick={closePdfViewer}
                className="text-gray-500 hover:text-gray-700"
              >
                <FaTimes size={24} />
              </button>
            </div>
            <div className="flex-grow p-2">
              <iframe
                src={selectedPdf} // ✅ Use direct preview link
                className="w-full h-full border-0"
                title="PDF Viewer"
              ></iframe>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvoicesArchive;