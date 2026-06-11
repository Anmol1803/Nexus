import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export default function EditCellModal({ value, column, onSave, onClose }) {
  const [val, setVal] = useState(value);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-sm">Edit Cell — <span className="text-primary">{column}</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Value</Label>
          <Textarea
            value={val}
            onChange={e => setVal(e.target.value)}
            className="font-mono text-sm min-h-[100px]"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => onSave(val)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}