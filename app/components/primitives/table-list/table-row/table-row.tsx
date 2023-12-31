import { cn } from "~/lib/utils";
import formatDate from "~/utils/format-date";

interface TableRowProps {
  /** the record of data  */
  row: any;
  children: React.ReactNode;
  isProcessing?: boolean;
  isError?: boolean;
  clazzName?: string;
  className?: string
  dateColumnsCondensed?: boolean;
  showDateColumns?: boolean;
}

export default function TableRow({
  row,
  children,
  isProcessing,
  isError,
  clazzName,
  className,
  dateColumnsCondensed,
  showDateColumns = true,
}: TableRowProps) {


  const dateColumns = dateColumnsCondensed === true ? (
    <TableDateColumnsCondensed
      createdAt={row?.createdAt}
      updatedAt={row?.updatedAt}
    />
  ) : (
    <TableDateColumnsExpanded
      createdAt={row?.createdAt}
      updatedAt={row?.updatedAt}
    />
  )

  return (
    <li
      data-element="table-row"
      className={
        cn(
          `cursor-pointer w-full grid gap-x-6 p-2 mb-2 text-sm items-center hover:bg-gray-200 border-b-2 border-b-gray-50 ${clazzName}`,
          isProcessing && "opacity-25",
          isError && "bg-red-100",
          className
        )
      }
    >
      {children}
      {showDateColumns === true && dateColumns}
    </li>
  );
}

function TableDateColumnsExpanded({ createdAt, updatedAt }: { createdAt: string, updatedAt: string }) {
  let createdAtDate = createdAt ? new Date(createdAt) : null;
  let updatedAtDate = updatedAt ? new Date(updatedAt) : null;

  return (
    <>
      <div>
        <span className="font-body font-medium">
          {formatDate(createdAtDate, "/")}
        </span>
      </div>
      <div>
        <span className="font-body font-medium">
          {formatDate(updatedAtDate, "/")}
        </span>
      </div>
    </>
  )

}


function TableDateColumnsCondensed({ createdAt, updatedAt }: { createdAt: string, updatedAt: string }) {
  let createdAtDate = createdAt ? new Date(createdAt) : null;
  let updatedAtDate = updatedAt ? new Date(updatedAt) : null;

  return (
    <div className="flex flex-col">
      {createdAtDate && (
        <div className="flex flex-col">
          <span className="font-body font-bold text-xs">Criado</span>
          <span className="font-body text-xs">
            {formatDate(createdAtDate, "/")}
          </span>
        </div>
      )}
      {updatedAtDate && (
        <div className="flex flex-col">
          <span className="font-body font-bold text-xs">Atualizado</span>
          <span className="font-body text-xs">
            {formatDate(updatedAtDate, "/")}
          </span>
        </div>
      )}
    </div>
  )

}
