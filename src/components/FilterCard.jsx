import React, { useState, useEffect } from 'react';

const FilterCard = ({ onApplyFilters, onResetFilters, tableData }) => {
  const [minBalance, setMinBalance] = useState('');
  const [maxBalance, setMaxBalance] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    // Set only the end date to today by default
    const today = new Date();
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  const handleBalanceChange = (type, value) => {
    if (type === 'min') {
      setMinBalance(value);
    } else {
      if (!minBalance || value === '' || parseFloat(value) >= parseFloat(minBalance)) {
        setMaxBalance(value);
      }
    }
  };

  const handleStartDateChange = (date) => {
    setStartDate(date);
    if (endDate && new Date(endDate) < new Date(date)) {
      setEndDate(date);
    }
  };

  const handleApplyFilters = () => {
    onApplyFilters({
      minBalance,
      maxBalance,
      startDate,
      endDate
    });
  };

  const handleResetFilters = () => {
    // Only reset to today's date for end date
    const today = new Date();
    
    setMinBalance('');
    setMaxBalance('');
    setStartDate('');
    setEndDate(today.toISOString().split('T')[0]);
    onResetFilters();
  };

  const downloadTableData = () => {
    if (!tableData || tableData.length === 0) {
      alert("No data available to download");
      return;
    }

    // Convert data to CSV format
    const headers = Object.keys(tableData[0]).join(',');
    const csvRows = tableData.map(row => 
      Object.values(row).map(value => 
        typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value
      ).join(',')
    );
    const csvContent = [headers, ...csvRows].join('\n');

    // Create a Blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `invoice_data_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">Filter Options</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Min Amount
          </label>
          <input
            type="number"
            value={minBalance}
            onChange={(e) => handleBalanceChange('min', e.target.value)}
            placeholder="Enter min amount (₹)"
            className="w-full rounded-md border border-gray-300 p-2"
            min="0"
            step="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Max Amount
          </label>
          <input
            type="number"
            value={maxBalance}
            onChange={(e) => handleBalanceChange('max', e.target.value)}
            placeholder="Enter max amount (₹)"
            className="w-full rounded-md border border-gray-300 p-2"
            min="0"
            step="100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Start Date
          </label>
          <input
            type="date"
            value={startDate}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => handleStartDateChange(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            End Date
          </label>
          <input
            type="date"
            value={endDate}
            min={startDate}
            max={new Date().toISOString().split("T")[0]}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end gap-4">
        <button
          onClick={handleResetFilters}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300 cursor-pointer transition-all ease-in-out"
        >
          Reset Filters
        </button>
        <button
          onClick={downloadTableData}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 cursor-pointer transition-all ease-in-out"
        >
          Download Data
        </button>
        <button
          onClick={handleApplyFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer transition-all ease-in-out"
        >
          Apply Filters
        </button>
      </div>
    </div>
  );
};

export default FilterCard;