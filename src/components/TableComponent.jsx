import React from "react";
import { FileText } from "lucide-react";
import { FaFilePdf } from "react-icons/fa"; // Import FaFilePdf icon

const TableComponent = ({
  data = [],
  columns = [],
  onPdfClick,
  title = "Data Table",
}) => {
  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "approved":
        return "bg-green-100 text-green-800"; // ✅ Green for Approved
      case "rejected":
        return "bg-red-100 text-red-800"; // 🔴 Red for Rejected
      case "flagged for review":
        return "bg-yellow-100 text-yellow-800";
      case "settled": // Corrected typo here
        return "bg-green-100 text-green-800";  // ✅ Green for Settled
      default:
        return "bg-gray-100 text-gray-800"; // ⚪ Default for unknown statuses
    }
  };

  return (
    <div className="mt-8 bg-white rounded-xl shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr className="bg-gray-50">
              {columns.map((column, index) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((column, colIndex) => (
                  <td
                    key={colIndex}
                    className={`px-6 py-4 text-sm ${
                      column.key === "products"
                        ? "whitespace-pre-line"
                        : "whitespace-nowrap"
                    }`}
                  >
                    {column.key === "status" ? (
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                          row[column.key]
                        )}`}
                      >
                        {row[column.key]}
                      </span>
                    ) : column.key === "pdfUrl" ||
                      column.key === "pdf_url" ||
                      column.key === "Invoices_pdf" ||
                      column.key === "Report_pdfs" ? (
                      row[column.key] ? (
                        <button
                          onClick={() =>
                            row[column.key]
                              ? onPdfClick?.(row[column.key])
                              : alert("No PDF attached.")
                          }
                          className="flex items-center justify-center bg-white hover:bg-gray-100 text-gray-800 font-semibold py-1 px-3 border border-gray-400 rounded shadow"
                          title="View PDF"
                        >
                          <FaFilePdf className="text-red-500 text-xl mr-2" />
                          View
                        </button>
                      ) : (
                        <span className="text-gray-400">N/A</span>
                      )
                    ) : column.key === "balanceDue" ? (
                      row[column.key] !== null &&
                      !isNaN(parseFloat(row[column.key])) ? (
                        <span>
                          ₹{parseFloat(row[column.key]).toLocaleString("en-IN")}
                        </span>
                      ) : (
                        <span></span>
                      )
                    ) : column.key === "products" ? (
                      <div className="whitespace-pre-line">
                        {row[column.key]}
                      </div>
                    ) : column.render ? (
                      column.render(row)
                    ) : (
                      row[column.key]
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TableComponent;