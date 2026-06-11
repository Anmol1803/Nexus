import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function AddColumnModal({ onAdd, onClose }) {
  const [name, setName] = useState("");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-sm">Add New Column</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Column Name</Label>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Enter column name..."
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!name.trim()} onClick={() => onAdd(name.trim())}>Add Column</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}