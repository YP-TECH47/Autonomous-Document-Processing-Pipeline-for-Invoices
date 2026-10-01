import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import FilterCard from "../components/FilterCard";
import TableComponent from "../components/TableComponent";
import SearchBar from "../components/SearchBar";
import supabase from "../supabaseClient";

const FlaggedForReview = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [userLevel, setUserLevel] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [actionType, setActionType] = useState(null);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [selectedPdf, setSelectedPdf] = useState(null);

  // Fetch logged-in user details
  useEffect(() => {
    const fetchUserDetails = async () => {
      const storedUser = localStorage.getItem("user");
      if (!storedUser) return;
      const { id } = JSON.parse(storedUser);
      const { data, error } = await supabase
        .from("users")
        .select("level")
        .eq("id", id)
        .single();
      if (error) {
        console.error("Error fetching user level:", error);
      } else {
        setUserLevel(data.level);
      }
    };
    fetchUserDetails();
  }, []);

  // Fetch flagged invoices data + vendor details
  const fetchDetails = async () => {
    try {
      const { data: flaggedInvoices, error: flaggedError } = await supabase
        .from("flagged")
        .select("order_id, invoice_id, vendor_id, invoice_date, reason, Invoices_pdf, Report_pdfs, status, level, urgency, total_amount, sgst_amount, cgst_amount, igst_amount");

      const { data: vendors, error: vendorsError } = await supabase
        .from("vendors_db")
        .select("vendor_id, vendor_name");

      if (flaggedError) console.error("Error fetching flagged invoices:", flaggedError);
      if (vendorsError) console.error("Error fetching vendors:", vendorsError);

      const vendorMap = {};
      vendors?.forEach((vendor) => {
        vendorMap[vendor.vendor_id] = vendor.vendor_name;
      });

      let mergedData = flaggedInvoices?.map((invoice) => ({
        ...invoice,
        vendor_name: vendorMap[invoice.vendor_id] || "Unknown Vendor",
      }));

      // Filter out approved and rejected invoices
      mergedData = mergedData?.filter((invoice) => invoice.status !== "Rejected" && invoice.status !== "Approved");
      
      // Sort by invoice_date (newest to oldest)
      mergedData?.sort((a, b) => {
        const dateA = new Date(a.invoice_date);
        const dateB = new Date(b.invoice_date);
        return dateB - dateA; // For descending order (newest first)
        // Use return dateA - dateB; for ascending order (oldest first)
      });

      setTableData(mergedData || []);
      setFilteredData(mergedData || []);
    } catch (err) {
      console.error("Unexpected error while fetching data:", err);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, []);

  // Updated PDF click handler
  const handlePdfClick = (pdfUrl) => {
    if (!pdfUrl) {
      alert("No PDF attached.");
      return;
    }
    setSelectedPdf(pdfUrl);
  };

  // Function to close the PDF viewer
  const closePdfViewer = () => {
    setSelectedPdf(null);
  };

  // Handle Approve action
  const handleApprove = (invoice) => {
    if (userLevel === null) {
      alert("User level is not yet loaded.");
      return;
    }
    setActionType("approve");
    setCurrentInvoice(invoice);
    setShowConfirmation(true);
  };

  // Handle Deny action
  const handleDeny = (invoice) => {
    if (userLevel === null) {
      alert("User level is not yet loaded.");
      return;
    }
    setActionType("reject");
    setCurrentInvoice(invoice);
    setShowConfirmation(true);
  };

  // Handle confirmation
  const handleConfirm = async () => {
    try {
      if (actionType === "approve") {
        // Insert into invoices table
        const { error: insertError } = await supabase.from("invoices").insert([
          {
            invoice_no: currentInvoice.invoice_id,
            order_id: currentInvoice.order_id,
            order_date: currentInvoice.invoice_date,
            total_amount: currentInvoice.total_amount,
            cgst_amount: currentInvoice.cgst_amount,
            sgst_amount: currentInvoice.sgst_amount,
            igst_amount: currentInvoice.igst_amount,
            vendor_id: currentInvoice.vendor_id,
            pdf_url: currentInvoice.Invoices_pdf,
            urgency: currentInvoice.urgency
          }
        ]);

        if (insertError) {
          console.error("Error inserting into invoices table:", insertError);
          return;
        }

        // Update status in flagged table
        const { error: updateError } = await supabase
          .from("flagged")
          .update({ status: "Approved" })
          .eq("order_id", currentInvoice.order_id);

        if (updateError) {
          console.error("Error updating status in flagged table:", updateError);
          return;
        }
      } else if (actionType === "reject") {
        // Only update status in flagged table
        const { error: updateError } = await supabase
          .from("flagged")
          .update({ status: "Rejected" })
          .eq("order_id", currentInvoice.order_id);

        if (updateError) {
          console.error("Error updating status in flagged table:", updateError);
          return;
        }
      }

      // Show success message
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setShowConfirmation(false);
        fetchDetails(); // Refresh data
      }, 2000);
    } catch (err) {
      console.error("Unexpected error:", err);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowConfirmation(false);
    setCurrentInvoice(null);
    setActionType(null);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <Navbar />
      <Sidebar />
      <main className="ml-[280px] pt-24 px-6">
        <h1 className="text-4xl font-serif font-bold text-gray-800 mb-8">
          Flagged for Review
        </h1>
        <FilterCard
          onApplyFilters={({ startDate, endDate }) => {
            let filtered = [...tableData];
            if (startDate && endDate) {
              filtered = filtered.filter((item) => {
                const itemDate = new Date(item.invoice_date);
                return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
              });
            }
            setFilteredData(filtered);
          }}
          onResetFilters={() => setFilteredData(tableData)}
          tableData={filteredData}
        />
        <SearchBar onSearch={setSearchQuery} />
        <TableComponent
          title="Flagged Invoices"
          columns={[
            { key: "order_id", label: "Order ID" },
            { key: "invoice_id", label: "Invoice ID" },
            { key: "vendor_name", label: "Vendor Name" },
            { key: "invoice_date", label: "Invoice Date" },
            { key: "reason", label: "Reason" },
            {
              key: "urgency",
              label: "Urgency",
              render: (row) => {
                let urgencyColor = "bg-green-100 text-green-700 border border-green-400"; // Default: No Urgency (Green)
                let urgencyText = "No Urgency"; // Default text
                if (row.urgency !== null) {
                  const urgencyValue = parseInt(row.urgency, 10);
                  urgencyText = `${urgencyValue} days`;
                  if (urgencyValue < 10) {
                    urgencyColor = "bg-red-100 text-red-700 border border-red-400"; // High urgency (Red)
                  } else {
                    urgencyColor = "bg-yellow-100 text-yellow-700 border border-yellow-400"; // Medium urgency (Yellow)
                  }
                }
                return (
                  <span className={`px-3 py-1 rounded-lg text-sm font-medium ${urgencyColor} shadow-sm`}>
                    {urgencyText}
                  </span>
                );
              },
            },
            { key: "Invoices_pdf", label: "Invoice PDF" },
            { key: "Report_pdfs", label: "Report PDFs" },
            {
              key: "approval",
              label: "Approval",
              render: (row) => (
                <div className="flex flex-col">
                  {userLevel !== null && row.level !== undefined ? (
                    userLevel >= row.level ? (
                      <div className="flex gap-4">
                        <button
                          onClick={() => handleApprove(row)}
                          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleDeny(row)}
                          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 cursor-pointer"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <p className="text-red-600 font-semibold">
                        You do not have the authority for approval of the invoice.
                      </p>
                    )
                  ) : (
                    <p className="text-gray-500">Loading...</p>
                  )}
                </div>
              ),
            },
          ]}
          data={filteredData.filter((invoice) => {
            if (!searchQuery) return true;
            const lowerSearch = searchQuery.toLowerCase();
            return (
              String(invoice.order_id).toLowerCase().includes(lowerSearch) ||
              String(invoice.invoice_id).toLowerCase().includes(lowerSearch) ||
              (invoice.vendor_name && invoice.vendor_name.toLowerCase().includes(lowerSearch))
            );
          })}
          onPdfClick={handlePdfClick}
        />
      </main>
      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-50 backdrop-blur-sm"></div>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative z-10">
            {!isSuccess ? (
              <>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">
                  {actionType === "approve" ? "Approve Invoice" : "Reject Invoice"}
                </h2>
                <p className="mb-6 text-gray-600">
                  Are you sure you want to {actionType === "approve" ? "approve" : "reject"} invoice{" "}
                  <span className="font-bold">{currentInvoice?.invoice_id}</span>?
                </p>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`px-4 py-2 text-white rounded cursor-pointer ${
                      actionType === "approve" ? "bg-green-600 hover:bg-green-700" : "bg-red-600 hover:bg-red-700"
                    }`}
                  >
                    Confirm
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-gray-800 mb-2">Success!</h3>
                <p className="text-gray-600">
                  Invoice has been {actionType === "approve" ? "approved" : "rejected"} successfully.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-grow p-2">
              <iframe
                src={selectedPdf}
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

export default FlaggedForReview;