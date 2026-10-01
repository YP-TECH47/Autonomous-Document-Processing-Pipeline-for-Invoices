import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import FilterCard from "../components/FilterCard";
import TableComponent from "../components/TableComponent";
import SearchBar from "../components/SearchBar";
import StatusBarGraph from "../components/StatusBarGraph";
import supabase from "../supabaseClient";

const Dashboard = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [rawData, setRawData] = useState({
    invoices: [],
    flagged: [],
    vendors: [],
  });

  // ✅ Fetch raw data
  const fetchDetails = async () => {
    try {
      // ✅ Fetch invoices (set status as "Approved")
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("order_id, invoice_no, order_date, vendor_id, total_amount");

      // ✅ Fetch flagged invoices (with status handling)
      const { data: flagged, error: flaggedError } = await supabase
        .from("flagged")
        .select("order_id, invoice_id, invoice_date, vendor_id, status, total_amount");

      // ✅ Fetch vendors (get vendor_name & gstin)
      const { data: vendors, error: vendorsError } = await supabase
        .from("vendors_db")
        .select("vendor_id, vendor_name, gstin");

      if (invoicesError)
        console.error("Error fetching invoices:", invoicesError);
      if (flaggedError)
        console.error("Error fetching flagged invoices:", flaggedError);
      if (vendorsError) console.error("Error fetching vendors:", vendorsError);

      setRawData({
        invoices: invoices || [],
        flagged: flagged || [],
        vendors: vendors || [],
      });
    } catch (err) {
      console.error("Unexpected error while fetching data:", err);
    }
  };

  // ✅ Process and merge data
  const generateTableData = () => {
    const { invoices, flagged, vendors } = rawData;

    // ✅ Create a lookup for vendor_name and gstin
    const vendorMap = {};
    vendors.forEach((vendor) => {
      vendorMap[vendor.vendor_id] = {
        vendor_name: vendor.vendor_name,
        gstin: vendor.gstin,
      };
    });

    const finalData = [];

    // ✅ Process invoices (set as "Approved")
    if (invoices.length) {
      invoices.forEach((invoice) => {
        finalData.push({
          order_id: invoice.order_id,
          invoice_id: invoice.invoice_no,
          invoice_date: invoice.order_date,
          vendor_id: invoice.vendor_id,
          vendor_name:
            vendorMap[invoice.vendor_id]?.vendor_name || "Unknown Vendor",
          gstin: vendorMap[invoice.vendor_id]?.gstin || "N/A",
          total: invoice.total_amount ? `₹${invoice.total_amount}` : "N/A", // ✅ Adds ₹ symbol
          status: "Approved",
        });
      });
    }

    // ✅ Process flagged invoices (handle status conditions)
    if (flagged.length) {
      flagged.forEach((flaggedEntry) => {
        // Skip flagged entries with "Approved" status
        if (flaggedEntry.status === "Approved") return;
        
        finalData.push({
          order_id: flaggedEntry.order_id,
          invoice_id: flaggedEntry.invoice_id,
          invoice_date: flaggedEntry.invoice_date,
          vendor_id: flaggedEntry.vendor_id,
          vendor_name:
            vendorMap[flaggedEntry.vendor_id]?.vendor_name || "Unknown Vendor",
          gstin: vendorMap[flaggedEntry.vendor_id]?.gstin || "N/A",
          total: flaggedEntry.total_amount ? `₹${flaggedEntry.total_amount}` : "N/A",
          status:
            flaggedEntry.status === "Rejected"
              ? "Rejected"
              : "Flagged for review",
        });
      });
    }

    // ✅ Sort by invoice_date (newest to oldest)
    finalData.sort((a, b) => {
      const dateA = new Date(a.invoice_date);
      const dateB = new Date(b.invoice_date);
      return dateB - dateA; // For descending order (newest first)
      // Use return dateA - dateB; for ascending order (oldest first)
    });

    return finalData;
  };

  // ✅ Function to sync data with dashboard_activity table
  const syncWithDashboardActivity = async (processedData) => {
    try {
      console.log("Starting sync with dashboard_activity...");
      
      // First, fetch existing records from dashboard_activity
      const { data: existingActivities, error: fetchError } = await supabase
        .from("dashboard_activity")
        .select("*");

      if (fetchError) {
        console.error("Error fetching dashboard_activity data:", fetchError);
        return;
      }

      console.log("Existing dashboard_activity entries:", existingActivities ? existingActivities.length : 0);

      // Create a lookup map for existing activities by order_id and invoice_id
      const existingMap = {};
      if (existingActivities && existingActivities.length) {
        existingActivities.forEach(activity => {
          // Create a unique key for each entry
          const key = `${activity.order_id}-${activity.invoice_id}`;
          existingMap[key] = activity;
        });
      }

      // Keep track of operations
      let insertCount = 0;
      let updateCount = 0;
      let noChangeCount = 0;

      // Process each item in the processed data
      for (const item of processedData) {
        // Make sure we extract the numeric amount from the total string
        const totalAmount = item.total.replace('₹', '').trim();
        
        // Create a unique key matching the format used for the lookup map
        const key = `${item.order_id}-${item.invoice_id}`;
        const existingItem = existingMap[key];

        // Prepare data for insertion/update - store vendor_id instead of vendor_name and gstin
        const recordData = {
          order_id: item.order_id,
          invoice_id: item.invoice_id,
          invoice_date: item.invoice_date,
          vendor_id: item.vendor_id, // Store vendor_id instead of vendor details directly
          total_amount: totalAmount,
          status: item.status,
          updated_at: new Date().toISOString()
        };

        console.log(`Processing item: ${key}`, recordData);
        console.log(`Item exists in DB: ${Boolean(existingItem)}`);

        if (!existingItem) {
          // If record doesn't exist, insert it
          console.log(`Inserting new record for ${key}`);
          
          const { data, error: insertError } = await supabase
            .from("dashboard_activity")
            .insert([recordData])
            .select();

          if (insertError) {
            console.error(`Error inserting record for ${key}:`, insertError);
          } else {
            console.log(`Successfully inserted record for ${key}:`, data);
            insertCount++;
          }
        } else {
          // Check if any field has changed
          const hasChanged = 
            existingItem.invoice_date !== item.invoice_date ||
            existingItem.vendor_id !== item.vendor_id || // Compare vendor_id instead
            existingItem.total_amount !== totalAmount ||
            existingItem.status !== item.status;

          console.log(`Changes detected for ${key}: ${hasChanged}`);
          
          if (hasChanged) {
            // Log what changed
            console.log("Changes:", {
              invoice_date: { old: existingItem.invoice_date, new: item.invoice_date, changed: existingItem.invoice_date !== item.invoice_date },
              vendor_id: { old: existingItem.vendor_id, new: item.vendor_id, changed: existingItem.vendor_id !== item.vendor_id },
              total_amount: { old: existingItem.total_amount, new: totalAmount, changed: existingItem.total_amount !== totalAmount },
              status: { old: existingItem.status, new: item.status, changed: existingItem.status !== item.status }
            });
            
            // Update the existing record with new values
            const { data, error: updateError } = await supabase
              .from("dashboard_activity")
              .update(recordData)
              .eq("order_id", item.order_id)
              .eq("invoice_id", item.invoice_id)
              .select();

            if (updateError) {
              console.error(`Error updating record for ${key}:`, updateError);
            } else {
              console.log(`Successfully updated record for ${key}:`, data);
              updateCount++;
            }
          } else {
            console.log(`No changes for ${key}, skipping update`);
            noChangeCount++;
          }
        }
      }

      console.log(`Dashboard activity sync complete: ${insertCount} inserts, ${updateCount} updates, ${noChangeCount} unchanged`);
    } catch (err) {
      console.error("Error syncing with dashboard_activity:", err);
    }
  };

  // ✅ Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      console.log("Fetching dashboard details...");
      await fetchDetails(); // Fetch raw data
    };

    fetchData();
  }, []);

  // ✅ Process data when rawData updates
  useEffect(() => {
    const processAndSyncData = async () => {
      if (rawData.invoices.length > 0 || rawData.flagged.length > 0) {
        const processedData = generateTableData();
        console.log("Processed Data:", processedData);
        setTableData(processedData);
        setFilteredData(processedData);
        
        // Sync the processed data with dashboard_activity table
        await syncWithDashboardActivity(processedData);
      }
    };
    
    processAndSyncData();
  }, [rawData]);

  // ✅ Apply Filters
  const handleApplyFilters = ({ minBalance, maxBalance, startDate, endDate }) => {
    let filtered = [...tableData];
  
    // ✅ Filter by total (min balance & max balance)
    if (minBalance) {
      filtered = filtered.filter((item) => {
        const totalValue = parseFloat(item.total.replace("₹", "").replace(",", ""));
        return totalValue >= parseFloat(minBalance);
      });
    }
  
    if (maxBalance) {
      filtered = filtered.filter((item) => {
        const totalValue = parseFloat(item.total.replace("₹", "").replace(",", ""));
        return totalValue <= parseFloat(maxBalance);
      });
    }
  
    // ✅ Filter by date range
    if (startDate && endDate) {
      filtered = filtered.filter((item) => {
        const itemDate = new Date(item.invoice_date);
        return itemDate >= new Date(startDate) && itemDate <= new Date(endDate);
      });
    }
  
    setFilteredData(filtered);
  };

  // ✅ Reset Filters
  const handleResetFilters = () => {
    setFilteredData(tableData);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case "Approved":
        return "text-green-600 font-semibold"; // ✅ Green for Approved
      case "Rejected":
        return "text-red-600 font-semibold"; // 🔴 Red for Rejected
      case "Flagged for review":
        return "text-yellow-600 font-semibold"; // 🟡 Yellow for Flagged
      default:
        return "text-gray-600"; // Default styling
    }
  };

  // ✅ Apply Search
  const searchFilteredData = filteredData.filter((entry) => {
    if (!searchQuery) return true;

    const lowerSearch = searchQuery.toLowerCase();
    return (
      (entry.invoice_id &&
        entry.invoice_id.toLowerCase().includes(lowerSearch)) || // For flagged invoices
      (entry.invoice_no &&
        entry.invoice_no.toLowerCase().includes(lowerSearch)) || // For approved invoices
      (entry.vendor_name &&
        entry.vendor_name.toLowerCase().includes(lowerSearch))
    );
  });

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <Navbar />
      <Sidebar />
  
      <main className="ml-[280px] pt-24 px-6">
        <h1 className="text-4xl font-serif font-bold text-gray-800 mb-8">
          Dashboard
        </h1>
  
        {/* ✅ Filter Card */}
        <FilterCard
          onApplyFilters={handleApplyFilters}
          onResetFilters={handleResetFilters}
          tableData={searchFilteredData}
        />
  
        {/* Status Bar Graph */}
        <StatusBarGraph data={searchFilteredData} />
  
        {/* ✅ SearchBar */}
        <SearchBar onSearch={setSearchQuery} />
  
        {/* ✅ TableComponent for Dashboard */}
        <TableComponent
          title="Dashboard Activity"
          columns={[
            { key: "order_id", label: "Order ID" },
            { key: "invoice_id", label: "Invoice ID" },
            { key: "vendor_name", label: "Vendor Name" },
            { key: "gstin", label: "GSTIN" },
            { key: "invoice_date", label: "Invoice Date" },
            { key: "total", label: "Total Amount" },
            {
              key: "status",
              label: "Status",
              render: (status) => (
                <span className={getStatusStyle(status)}>{status}</span>
              ),
            },
          ]}
          data={searchFilteredData}
        />
      </main>
    </div>
  );
};

export default Dashboard;