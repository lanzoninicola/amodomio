// app/components/DraggableList.tsx
import { useFetcher } from '@remix-run/react';
import React, { useState } from 'react';



interface DraggableListProps {
    initialItems: any[];
    children?: React.ReactNode;
}

const DraggableList: React.FC<DraggableListProps> = ({ initialItems, children }) => {
    const [items, setItems] = useState<any[]>(initialItems);
    const [draggingItemIndex, setDraggingItemIndex] = useState<number | null>(null);
    const fetcher = useFetcher();

    const handleDragStart = (index: number) => {
        setDraggingItemIndex(index);
    };

    const handleDragOver = (event: React.DragEvent<HTMLLIElement>, index: number) => {
        event.preventDefault();
        if (draggingItemIndex === index) return;

        const updatedItems = [...items];
        const [draggedItem] = updatedItems.splice(draggingItemIndex!, 1);
        updatedItems.splice(index, 0, draggedItem);
        setDraggingItemIndex(index);
        setItems(updatedItems);
    };

    const handleDragEnd = () => {
        setDraggingItemIndex(null);

        // Update the database
        fetcher.submit(
            { items: JSON.stringify(items.map((item, index) => ({ ...item, index }))) },
            { method: 'post', action: '/items/reorder' }
        );
    };

    return (
        <ul>
            {items.map((item, index) => (
                <li
                    key={item.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(event) => handleDragOver(event, index)}
                    onDragEnd={handleDragEnd}
                    style={{
                        padding: '8px',
                        margin: '4px',
                        backgroundColor: 'lightgray',
                        cursor: 'grab',
                    }}
                >
                    {children }
                </li>
            ))}
        </ul>
    );
};

export default DraggableList;
