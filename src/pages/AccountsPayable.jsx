import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import FilterCard from "../components/FilterCard";
import TableComponent from "../components/TableComponent";
import SearchBar from "../components/SearchBar";
import supabase from "../supabaseClient";

const AccountsPayable = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Populate accounts_payable table from invoices (would typically be done by a scheduled function)
  const populateAccountsPayable = async () => {
    try {
      // Fetch all unpaid invoices from invoices table
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("invoice_no, vendor_id, order_date, total_amount, urgency, payment_status")
        .neq("payment_status", "Paid"); // Only unpaid invoices
  
      if (invoicesError) {
        console.error("Error fetching invoices:", invoicesError);
        return;
      }
  
      // Fetch existing invoice entries from accounts_payable
      const { data: existingPayables, error: existingError } = await supabase
        .from("accounts_payable")
        .select("invoice_id, vendor_id, due_date, payment_status, total_amount");
  
      if (existingError) {
        console.error("Error fetching existing payables:", existingError);
        return;
      }
  
      // Convert existing records into a Map for quick lookup
      const existingPayableMap = new Map(existingPayables.map(item => [item.invoice_id, item]));
  
      const newEntries = [];
      const updates = [];
  
      invoices.forEach(invoice => {
        const existingEntry = existingPayableMap.get(invoice.invoice_no);
  
        // Calculate due date based on urgency
        let dueDate = "No Due Date";
        if (invoice.urgency !== null&& invoice.urgency > 0) {
          const orderDate = new Date(invoice.order_date);
          orderDate.setDate(orderDate.getDate() + parseInt(invoice.urgency, 10));
          dueDate = orderDate.toISOString().split('T')[0]; // Format YYYY-MM-DD
        }
  
        const updatedEntry = {
          invoice_id: invoice.invoice_no,
          vendor_id: invoice.vendor_id,
          due_date: dueDate,
          payment_status: invoice.payment_status || "Unpaid",
          total_amount: invoice.total_amount,
        };
  
        if (existingEntry) {
          // If there is an existing entry, check if any values have changed
          const hasChanged = Object.keys(updatedEntry).some(
            key => updatedEntry[key] !== existingEntry[key]
          );
  
          if (hasChanged) {
            updates.push(updatedEntry);
          }
        } else {
          // If no existing entry, add to new entries
          newEntries.push({ ...updatedEntry, transaction_id: null });
        }
      });
  
      // Perform bulk update if there are changes
      if (updates.length > 0) {
        for (const update of updates) {
          const { error: updateError } = await supabase
            .from("accounts_payable")
            .update(update)
            .eq("invoice_id", update.invoice_id);
  
          if (updateError) {
            console.error(`Error updating invoice ${update.invoice_id}:`, updateError);
          }
        }
        console.log(`Updated ${updates.length} invoices in accounts_payable.`);
      }
  
      // Insert new invoices
      if (newEntries.length > 0) {
        const { error: insertError } = await supabase
          .from("accounts_payable")
          .insert(newEntries);
  
        if (insertError) {
          console.error("Error inserting into accounts_payable:", insertError);
        } else {
          console.log(`Inserted ${newEntries.length} new invoices into accounts_payable.`);
        }
      } else {
        console.log("No new invoices to add to accounts_payable.");
      }
    } catch (err) {
      console.error("Error in populateAccountsPayable:", err);
    }
  };
  // Fetch accounts payable data
  const fetchAccountsPayable = async () => {
    setIsLoading(true);
    try {
      // First ensure accounts_payable is up to date
      await populateAccountsPayable();
      
      // Then fetch the accounts payable data with vendor details
      const { data, error } = await supabase
        .from("accounts_payable")
        .select(`
          invoice_id,
          vendor_id,
          due_date,
          payment_status,
          total_amount,
          transaction_id,
          vendors_db (
            vendor_name,
            gstin
          )
        `)
        .neq("payment_status", "Paid");

      if (error) {
        console.error("Error fetching accounts payable:", error);
        return;
      }

      // Transform the data to flatten vendor info
      const transformedData = data.map(item => ({
        invoice_id: item.invoice_id,
        vendor_id: item.vendor_id,
        vendor_name: item.vendors_db?.vendor_name || "Unknown Vendor",
        gstin: item.vendors_db?.gstin || "N/A",
        due_date: item.due_date,
        payment_status: item.payment_status,
        total_amount: item.total_amount,
        transaction_id: item.transaction_id
      }));

      // Sort by due date (closest first)
      transformedData.sort((a, b) => {
        if (a.due_date === "No Due Date") return 1;
        if (b.due_date === "No Due Date") return -1;
        return new Date(a.due_date) - new Date(b.due_date);
      });

      setTableData(transformedData);
      setFilteredData(transformedData);
    } catch (err) {
      console.error("Unexpected error while fetching data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAccountsPayable();
  }, []);

  // Handle Pay Now action
  const handlePayNow = (invoice) => {
    setCurrentInvoice(invoice);
    setShowConfirmation(true);
  };

  // Handle payment confirmation
  const handleConfirmPayment = async () => {
    try {
      // Update payment status in accounts_payable table
      const { error: updateAccountsPayableError } = await supabase
        .from("accounts_payable")
        .update({ payment_status: "Paid" })
        .eq("invoice_id", currentInvoice.invoice_id);
  
      if (updateAccountsPayableError) {
        console.error("Error updating accounts_payable:", updateAccountsPayableError);
        return;
      }
  
      // Update payment status in invoices table
      const { error: updateInvoicesError } = await supabase
        .from("invoices")
        .update({ payment_status: "Paid" })
        .eq("invoice_no", currentInvoice.invoice_id);
  
      if (updateInvoicesError) {
        console.error("Error updating invoices:", updateInvoicesError);
        return;
      }
  
      // Show success message and refresh data
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        setShowConfirmation(false);
        fetchAccountsPayable(); // Refresh data
      }, 2000);
    } catch (err) {
      console.error("Unexpected error during payment:", err);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setShowConfirmation(false);
    setCurrentInvoice(null);
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <Navbar />
      <Sidebar />
      <main className="ml-[280px] pt-24 px-6">
        <h1 className="text-4xl font-serif font-bold text-gray-800 mb-8">
          Accounts Payable
        </h1>
        <FilterCard
          onApplyFilters={({ startDate, endDate }) => {
            let filtered = [...tableData];
            if (startDate && endDate) {
              filtered = filtered.filter((item) => {
                if (item.due_date === "No Due Date") return true;
                const dueDate = new Date(item.due_date);
                return dueDate >= new Date(startDate) && dueDate <= new Date(endDate);
              });
            }
            setFilteredData(filtered);
          }}
          onResetFilters={() => setFilteredData(tableData)}
          tableData={filteredData}
        />
        <SearchBar onSearch={setSearchQuery} />
        
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <TableComponent
            title="Invoices Due for Payment"
            columns={[
              { key: "invoice_id", label: "Invoice ID" },
              { key: "vendor_name", label: "Vendor Name" },
              { key: "gstin", label: "GSTIN" },
              { key: "due_date", label: "Due Date" },
              { key: "total_amount", label: "Total Amount", 
                render: (row) => (
                  <span>₹{parseFloat(row.total_amount).toLocaleString('en-IN')}</span>
                )
              },
              {
                key: "payment_status",
                label: "Payment Status",
                render: (row) => {
                  let statusColor = "bg-yellow-100 text-yellow-700 border border-yellow-400";
                  return (
                    <span className={`px-3 py-1 rounded-lg text-sm font-medium ${statusColor} shadow-sm`}>
                      {row.payment_status}
                    </span>
                  );
                },
              },
              {
                key: "action",
                label: "Action",
                render: (row) => (
                  <button
                    onClick={() => handlePayNow(row)}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  >
                    Pay Now
                  </button>
                ),
              },
            ]}
            data={filteredData.filter((invoice) => {
              if (!searchQuery) return true;
              const lowerSearch = searchQuery.toLowerCase();
              return (
                String(invoice.invoice_id).toLowerCase().includes(lowerSearch) ||
                (invoice.vendor_name && invoice.vendor_name.toLowerCase().includes(lowerSearch)) ||
                (invoice.gstin && invoice.gstin.toLowerCase().includes(lowerSearch))
              );
            })}
          />
        )}
      </main>

      {/* Payment Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 flex items-center justify-center z-50">
          <div className="absolute inset-0 bg-black opacity-50 backdrop-blur-sm"></div>
          <div className="bg-white rounded-lg shadow-xl p-6 w-96 relative z-10">
            {!isSuccess ? (
              <>
                <h2 className="text-2xl font-bold mb-4 text-gray-800">
                  Confirm Payment
                </h2>
                <p className="mb-2 text-gray-600">
                  Are you sure you want to process payment for:
                </p>
                <div className="bg-gray-50 p-4 rounded-lg mb-4">
                  <p><span className="font-semibold">Invoice:</span> {currentInvoice?.invoice_id}</p>
                  <p><span className="font-semibold">Vendor:</span> {currentInvoice?.vendor_name}</p>
                  <p><span className="font-semibold">Amount:</span> ₹{parseFloat(currentInvoice?.total_amount).toLocaleString('en-IN')}</p>
                  {currentInvoice?.due_date !== "No Due Date" && (
                    <p><span className="font-semibold">Due Date:</span> {currentInvoice?.due_date}</p>
                  )}
                </div>
                <div className="flex justify-end gap-4">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirmPayment}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
                  >
                    Confirm Payment
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
                <h3 className="text-xl font-bold text-gray-800 mb-2">Payment Successful!</h3>
                <p className="text-gray-600">
                  Invoice has been successfully paid.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountsPayable;