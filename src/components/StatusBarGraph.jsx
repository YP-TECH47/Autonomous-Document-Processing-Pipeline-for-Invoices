import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const StatusBarGraph = ({ data }) => {
  const [monthlyData, setMonthlyData] = useState([]);
  const [activeStatus, setActiveStatus] = useState('all');
  
  useEffect(() => {
    // Process data to group by month-year
    const processMonthlyData = () => {
      // Create a mapping of invoice dates to month-year strings
      const monthMap = {};
      
      data.forEach(item => {
        if (!item.invoice_date) return;
        
        const date = new Date(item.invoice_date);
        const monthYear = `${date.toLocaleString('default', { month: 'short' })}-${date.getFullYear()}`;
        
        if (!monthMap[monthYear]) {
          monthMap[monthYear] = {
            monthYear,
            "Approved": 0,
            "Rejected": 0,
            "Flagged for review": 0
          };
        }
        
        // Increment the appropriate status counter
        if (monthMap[monthYear].hasOwnProperty(item.status)) {
          monthMap[monthYear][item.status]++;
        }
      });
      
      // Convert the map to an array and sort by date
      const sortedData = Object.values(monthMap);
      sortedData.sort((a, b) => {
        const [monthA, yearA] = a.monthYear.split('-');
        const [monthB, yearB] = b.monthYear.split('-');
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthIndexA = months.indexOf(monthA);
        const monthIndexB = months.indexOf(monthB);
        
        // First sort by year, then by month
        if (yearA !== yearB) return parseInt(yearA) - parseInt(yearB);
        return monthIndexA - monthIndexB;
      });
      
      return sortedData;
    };
    
    setMonthlyData(processMonthlyData());
  }, [data]);
  
  // Define status colors - more subtle, modern palette
  const statusColors = {
    "Approved": "#10b981", // Softer green
    "Rejected": "#f43f5e", // Softer red
    "Flagged for review": "#f59e0b" // Softer amber
  };
  
  // Status tabs for switching between graphs
  const statusTabs = [
    { id: 'all', label: 'All Statuses' },
    { id: 'Approved', label: 'Approved' },
    { id: 'Rejected', label: 'Rejected' },
    { id: 'Flagged for review', label: 'Flagged for Review' }
  ];
  
  // Custom tooltip for more detailed information on hover
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-100 rounded-lg shadow-lg text-gray-800">
          <p className="font-medium mb-2 text-gray-600">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 py-1">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: entry.color }}
              ></div>
              <span className="text-sm">{entry.name}:</span>
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-md p-6 mb-8 border border-gray-50">
      <h2 className="text-xl font-semibold mb-2 text-gray-800">Invoice Status by Month</h2>
      <p className="text-gray-500 mb-6 text-sm">Distribution of invoice statuses over time</p>
      
      {/* Status selection tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {statusTabs.map(tab => (
          <button
            key={tab.id}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
              activeStatus === tab.id 
                ? 'bg-blue-50 text-blue-600 border border-blue-200 shadow-sm' 
                : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
            }`}
            onClick={() => setActiveStatus(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      
      {/* Chart container with increased height */}
      <div className="w-full h-96 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={monthlyData}
            margin={{ top: 10, right: 20, left: 10, bottom: 40 }}
            barGap={4}
            barSize={activeStatus !== 'all' ? 40 : 24}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis 
              dataKey="monthYear" 
              angle={-45} 
              textAnchor="end" 
              height={60} 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
            />
            <YAxis 
              allowDecimals={false} 
              tick={{ fontSize: 12, fill: '#6b7280' }}
              tickLine={false}
              axisLine={{ stroke: '#e5e7eb' }}
              width={40}
            />
            <Tooltip 
              content={<CustomTooltip />} 
              cursor={{ fill: 'rgba(236, 236, 236, 0.4)' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: 20 }}
              iconType="circle"
              iconSize={8}
            />
            
            {/* Conditionally render bars based on active status */}
            {(activeStatus === 'all' || activeStatus === 'Approved') && (
              <Bar 
                dataKey="Approved" 
                name="Approved" 
                fill={statusColors["Approved"]}
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
            )}
            
            {(activeStatus === 'all' || activeStatus === 'Rejected') && (
              <Bar 
                dataKey="Rejected" 
                name="Rejected" 
                fill={statusColors["Rejected"]}
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
            )}
            
            {(activeStatus === 'all' || activeStatus === 'Flagged for review') && (
              <Bar 
                dataKey="Flagged for review" 
                name="Flagged for Review" 
                fill={statusColors["Flagged for review"]}
                fillOpacity={0.85}
                radius={[4, 4, 0, 0]}
                animationDuration={1000}
              />
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Status summary cards with improved design */}
      <div className="mt-8 grid grid-cols-3 gap-6">
        {Object.entries(statusColors).map(([status, color]) => {
          const count = data.filter(item => item.status === status).length;
          const percentage = data.length > 0 ? Math.round((count / data.length) * 100) : 0;
          
          return (
            <div key={status} className="flex flex-col p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }}></div>
                <span className="font-medium text-gray-700">{status}</span>
              </div>
              <div className="text-3xl font-bold text-gray-800 mb-1">{count}</div>
              <div className="text-sm text-gray-500 flex items-center">
                <div 
                  className="h-1 mr-2 rounded" 
                  style={{ 
                    backgroundColor: color, 
                    width: `${Math.max(percentage, 5)}%`, 
                    opacity: 0.7 
                  }}
                ></div>
                {percentage}% of total
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatusBarGraph;