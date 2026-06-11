import React, { useState } from "react";
import FileUpload from "@/components/data/FileUpload";
import DataWorkspace from "@/components/data/DataWorkspace";

export default function Home() {
  const [dataset, setDataset] = useState(null);
  const [columns, setColumns] = useState([]);
  const [fileName, setFileName] = useState("");

  const handleDataLoaded = (data, cols, name) => {
    setDataset(data);
    setColumns(cols);
    setFileName(name);
  };

  const handleReset = () => {
    setDataset(null);
    setColumns([]);
    setFileName("");
  };

  return (
    <div className="min-h-screen bg-background">
      {!dataset ? (
        <FileUpload onDataLoaded={handleDataLoaded} />
      ) : (
        <DataWorkspace
          initialData={dataset}
          columns={columns}
          fileName={fileName}
          onReset={handleReset}
        />
      )}
    </div>
  );
}