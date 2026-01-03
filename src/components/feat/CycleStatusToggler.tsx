import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

type Props = {
  currentStatus: string;
  onStatusChange: (newStatus: string) => void;
};

export function CycleStatusToggler(props: Props) {
  // For optimistic update
  const [localStatus, setLocalStatus] = useState("PENDING");

  useEffect(() => {
    setLocalStatus(props.currentStatus);
  }, [props.currentStatus]);

  function triggerStatusChange(newStatus: string) {
    setLocalStatus(newStatus);
    props.onStatusChange(newStatus);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {localStatus === "PENDING" ? (
          <Button
            className={
              "font-bold bg-orange-400 hover:bg-orange-300 text-white rounded-sm tracking-wide p-2 text-xs h-8"
            }
          >
            Pending
          </Button>
        ) : (
          <Button
            className={
              "font-bold bg-green-400 hover:bg-green-300 text-white rounded-sm tracking-wide p-2 text-xs h-8"
            }
          >
            Paid
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => triggerStatusChange("PENDING")}>
          Pending
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => triggerStatusChange("PAID")}>
          Paid
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
