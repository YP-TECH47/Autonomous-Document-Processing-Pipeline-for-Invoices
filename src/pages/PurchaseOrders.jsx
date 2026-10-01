import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";
import FilterCard from "../components/FilterCard";
import TableComponent from "../components/TableComponent";
import SearchBar from "../components/SearchBar";
import supabase from "../supabaseClient";

const PurchaseOrders = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [tableData, setTableData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [rawData, setRawData] = useState({
    orders: [],
    orderItems: [],
    vendors: [],
    invoices: [], // ✅ Fetch invoices to determine status
  });

  // ✅ Fetch raw data


  // ✅ Process and merge data
  const fetchDetails = async () => {
    try {
      // Fetch purchase orders sorted by order_date
      const { data: orders, error: ordersError } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("order_date", { ascending: false });
  
      // Fetch purchase order items
      const { data: orderItems, error: itemsError } = await supabase.from("purchase_order_item").select(
        "order_id, product_id, product_description, unit_price, quantity, line_total, cgst_rate, sgst_rate, igst_rate"
      );
  
      // Fetch vendors
      const { data: vendors, error: vendorsError } = await supabase.from("vendors_db").select("vendor_id, vendor_name, gstin");
  
      // Fetch invoices with order_id and payment_status
      const { data: invoices, error: invoicesError } = await supabase
        .from("invoices")
        .select("order_id, payment_status");
  
      if (ordersError) console.error("Error fetching purchase orders:", ordersError);
      if (itemsError) console.error("Error fetching order items:", itemsError);
      if (vendorsError) console.error("Error fetching vendors:", vendorsError);
      if (invoicesError) console.error("Error fetching invoices:", invoicesError);
  
      setRawData({
        orders: orders || [],
        orderItems: orderItems || [],
        vendors: vendors || [],
        invoices: invoices || [],
      });
    } catch (err) {
      console.error("Unexpected error while fetching data:", err);
    }
  };
  
  const generateTableData = () => {
    const { orders, orderItems, vendors, invoices } = rawData;
  
    // Create a lookup for vendor_name and gstin
    const vendorMap = {};
    vendors.forEach((vendor) => {
      vendorMap[vendor.vendor_id] = { vendor_name: vendor.vendor_name, gstin: vendor.gstin };
    });
  
    // Create a lookup for payment_status
    const invoiceStatusMap = {};
    invoices.forEach((invoice) => {
      invoiceStatusMap[invoice.order_id] = invoice.payment_status === "Paid" ? "Settled" : "Unsettled";
    });
  
    const finalData = [];
  
    orders.forEach((order) => {
      const products = orderItems.filter((item) => item.order_id === order.order_id);
      const status = invoiceStatusMap[order.order_id] || "Unsettled"; // Check payment status
  
      if (products.length === 0) {
        finalData.push({
          order_id: order.order_id,
          vendor_name: vendorMap[order.vendor_id]?.vendor_name || "Unknown Vendor",
          gstin: vendorMap[order.vendor_id]?.gstin || "N/A",
          order_date: order.order_date,
          balanceDue: order.total_amount ? `₹${order.total_amount}` : "N/A",
          status: status,
          product_id: "No Products",
          product_description: "No Products",
          unit_price: "No Products",
          quantity: "No Products",
          total_price: "No Products",
          cgst_rate: "N/A",
          sgst_rate: "N/A",
          igst_rate: "N/A",
        });
      } else {
        products.forEach((product, index) => {
          finalData.push({
            order_id: index === 0 ? order.order_id : "",
            vendor_name: index === 0 ? vendorMap[order.vendor_id]?.vendor_name || "Unknown Vendor" : "",
            gstin: index === 0 ? vendorMap[order.vendor_id]?.gstin || "N/A" : "",
            order_date: index === 0 ? order.order_date : "",
            balanceDue: index === 0 ? order.total_amount : "",
            status: index === 0 ? status : "",
            product_id: product.product_id,
            product_description: product.product_description,
            unit_price: product.unit_price ? `₹${product.unit_price}` : "N/A",
            quantity: product.quantity,
            total_price: product.line_total ? `₹${product.line_total}` : "N/A",
            cgst_rate: product.cgst_rate ? `${product.cgst_rate}%` : "N/A",
            sgst_rate: product.sgst_rate ? `${product.sgst_rate}%` : "N/A",
            igst_rate: product.igst_rate ? `${product.igst_rate}%` : "N/A",
          });
        });
      }
    });
  
    return finalData;
  };

  // ✅ Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      console.log("Fetching purchase details...");
      await fetchDetails(); // Fetch raw data
    };

    fetchData();
  }, []);

  // ✅ Process data when rawData updates
  useEffect(() => {
    if (rawData.orders.length) {
      const processedData = generateTableData();
      console.log("Processed Data:", processedData);
      setTableData(processedData);
      setFilteredData(processedData);
    }
  }, [rawData]);

  // ✅ Apply Filters
  // ✅ Apply Filters
const handleApplyFilters = ({ minBalance, maxBalance, startDate, endDate }) => {
  // First, filter only the purchase orders that match the criteria
  const filteredOrders = rawData.orders.filter((order) => {
    let matchesFilter = true;
    
    if (minBalance) {
      matchesFilter = matchesFilter && order.total_amount >= parseFloat(minBalance);
    }
    
    if (maxBalance) {
      matchesFilter = matchesFilter && order.total_amount <= parseFloat(maxBalance);
    }
    
    if (startDate && endDate) {
      const orderDate = new Date(order.order_date);
      matchesFilter = matchesFilter && orderDate >= new Date(startDate) && orderDate <= new Date(endDate);
    }
    
    return matchesFilter;
  });

  // Get the filtered order IDs
  const filteredOrderIds = new Set(filteredOrders.map(order => order.order_id));
  
  // Now regenerate the table data but only for the filtered orders
  const { orderItems, vendors, invoices } = rawData;
  
  // Create a lookup for vendor_name and gstin
  const vendorMap = {};
  vendors.forEach((vendor) => {
    vendorMap[vendor.vendor_id] = { vendor_name: vendor.vendor_name, gstin: vendor.gstin };
  });

  // Create a lookup for settled orders
  const settledOrders = new Set(invoices.map((invoice) => invoice.order_id));

  const filteredData = [];

  filteredOrders.forEach((order) => {
    const products = orderItems.filter((item) => item.order_id === order.order_id);
    const status = settledOrders.has(order.order_id) ? "Settled" : "Unsettled";

    if (products.length === 0) {
      filteredData.push({
        order_id: order.order_id,
        vendor_name: vendorMap[order.vendor_id]?.vendor_name || "Unknown Vendor",
        gstin: vendorMap[order.vendor_id]?.gstin || "N/A",
        order_date: order.order_date,
        balanceDue: order.total_amount ? `₹${order.total_amount}` : "N/A",
        status: status,
        product_id: "No Products",
        product_description: "No Products",
        unit_price: "No Products",
        quantity: "No Products",
        total_price: "No Products",
        cgst_rate: "N/A",
        sgst_rate: "N/A",
        igst_rate: "N/A",
      });
    } else {
      products.forEach((product, index) => {
        filteredData.push({
          order_id: index === 0 ? order.order_id : "",
          vendor_name: index === 0 ? vendorMap[order.vendor_id]?.vendor_name || "Unknown Vendor" : "",
          gstin: index === 0 ? vendorMap[order.vendor_id]?.gstin || "N/A" : "",
          order_date: index === 0 ? order.order_date : "",
          balanceDue: index === 0 ? order.total_amount : "",
          status: index === 0 ? status : "",
          product_id: product.product_id,
          product_description: product.product_description,
          unit_price: product.unit_price ? `₹${product.unit_price}` : "N/A",
          quantity: product.quantity,
          total_price: product.line_total ? `₹${product.line_total}` : "N/A",
          cgst_rate: product.cgst_rate ? `${product.cgst_rate}%` : "N/A",
          sgst_rate: product.sgst_rate ? `${product.sgst_rate}%` : "N/A",
          igst_rate: product.igst_rate ? `${product.igst_rate}%` : "N/A",
        });
      });
    }
  });

  setFilteredData(filteredData);
};

  // ✅ Reset Filters
  const handleResetFilters = () => {
    setFilteredData(tableData);
  };

  // ✅ Apply Search
  const searchFilteredData = filteredData.filter((order) => {
    if (!searchQuery) return true;

    const lowerSearch = searchQuery.toLowerCase();
    return (
      String(order.order_id).toLowerCase().includes(lowerSearch) ||
      (order.vendor_name && order.vendor_name.toLowerCase().includes(lowerSearch))
    );
  });

  // Helper function for status styling that was missing
  const getStatusStyle = (status) => {
    switch (status) {
      case "Settled":
        return "bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium";
      case "Unsettled":
        return "bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium";
      default:
        return "bg-gray-100 text-gray-800 px-2 py-1 rounded-full text-xs font-medium";
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F2F2]">
      <Navbar />
      <Sidebar />

      <main className="ml-[280px] pt-24 px-6">
        <h1 className="text-4xl font-serif font-bold text-gray-800 mb-8">Purchase Orders</h1>

        {/* ✅ FilterCard */}
        <FilterCard 
          onApplyFilters={handleApplyFilters} 
          onResetFilters={handleResetFilters}
          tableData={searchFilteredData} 
        />

        {/* ✅ SearchBar */}
        <SearchBar onSearch={setSearchQuery} />

        {/* ✅ TableComponent */}
        <TableComponent 
          title="Purchase Orders" 
          columns={[
            { key: "order_id", label: "Order ID" },
            { key: "vendor_name", label: "Vendor Name" },
            { key: "gstin", label: "GSTIN" },
            { key: "order_date", label: "Order Date" },
            { key: "balanceDue", label: "Balance Due" },
            {
              key: "status",
              label: "Status",
              render: (status) => (
                <span className={getStatusStyle(status)}>{status}</span>
              ),
            },
            { key: "total_price", label: "Total Price" },
            { key: "product_id", label: "Product ID" }, 
            { key: "product_description", label: "Product Description" },
            { key: "unit_price", label: "Unit Price" },
            { key: "quantity", label: "Quantity" },
            { key: "cgst_rate", label: "CGST Rate (%)" },
            { key: "sgst_rate", label: "SGST Rate (%)" },
            { key: "igst_rate", label: "IGST Rate (%)" },
          ]} 
          data={searchFilteredData} 
        />
      </main>
    </div>
  );
};

export default PurchaseOrders;