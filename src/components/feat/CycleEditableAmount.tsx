import {
  centsToRealAmount,
  centsToRealAmountNotFormatted,
  toCents,
} from "@/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { PencilLine, X, Check } from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "../ui/input";

type Props = {
  amount: number;
  editIsAllowed: boolean;
  onEditConfirmed?: (amount: number) => void;
};

export function CycleEditableAmount({
  amount,
  editIsAllowed,
  onEditConfirmed,
}: Props) {
  const [isEdit, setIsEdit] = useState(false);
  const [editedAmount, setEditedAmount] = useState(
    centsToRealAmountNotFormatted(amount),
  );
  const presentedAmount = useMemo(() => {
    const cents = toCents(editedAmount);
    return centsToRealAmount(cents);
  }, [editedAmount]);

  return (
    <Badge variant="secondary" className="flex gap-1 items-center">
      {editIsAllowed && (
        <>
          {isEdit ? (
            <>
              <Button
                variant="secondary"
                className="p-0 h-6"
                onClick={() => {
                  setIsEdit(false);
                  setEditedAmount(centsToRealAmountNotFormatted(amount));
                }}
              >
                <X size={12} />
              </Button>
            </>
          ) : (
            <Button
              variant="secondary"
              className="p-0 h-6"
              onClick={() => {
                setIsEdit(true);
              }}
            >
              <PencilLine size={12} />
            </Button>
          )}
        </>
      )}
      {isEdit ? (
        <Input
          className="w-16 bg-transparent border-0 border-b-2 rounded-b-none border-b-gray-400"
          value={editedAmount}
          onChange={(ev) => setEditedAmount(Number(ev.target.value))}
        />
      ) : (
        <span>R$ {presentedAmount}</span>
      )}
      {isEdit && (
        <Button
          variant="secondary"
          className="p-1 rounded-full h-5 bg-green-300"
          onClick={() => {
            setIsEdit(false);
            onEditConfirmed(editedAmount);
          }}
        >
          <Check size={12} />
        </Button>
      )}
    </Badge>
  );
}
