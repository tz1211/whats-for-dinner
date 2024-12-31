import { useState, useEffect } from "react";
import { FridgeItem, addItem, editItem, deleteItem } from "@whatsfordinner/sdk"; 
import { Osdk } from "@osdk/client";
import css from "./Home.module.css";
import client from "./client";

function Home() {
  const [objects, setObjects] = useState<Osdk.Instance<FridgeItem>[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<Osdk.Instance<FridgeItem> | null>(null);
  const [editingItem, setEditingItem] = useState<Osdk.Instance<FridgeItem> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);
  const [waitingForExpiration, setWaitingForExpiration] = useState<{
    itemId: string;
    originalDaysUntilExpiration: number | undefined;
  } | null>(null);
  const [addForm, setAddForm] = useState({
    name: "",
    quantity: 0,
    useBy: "",
    noUseBy: false,
  });
  const [editForm, setEditForm] = useState({
    name: "",
    quantity: 0,
    useBy: "",
    noUseBy: false,
  });
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isSelecting, setIsSelecting] = useState(false);
  const [expiryFilters, setExpiryFilters] = useState<Set<string>>(new Set(['all']));
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Set document title
  useEffect(() => {
    document.title = "What's for Dinner";
  }, []);

  useEffect(() => {
    async function fetchObjects() {
      const items: Osdk.Instance<FridgeItem>[] = [];
      for await (const obj of client(FridgeItem).asyncIter()) {
        items.push(obj);
      }
      setObjects(items);
    }
    fetchObjects();
  }, []);

  useEffect(() => {
    if (waitingForExpiration) {
      const interval = setInterval(async () => {
        const items: Osdk.Instance<FridgeItem>[] = [];
        for await (const obj of client(FridgeItem).asyncIter()) {
          items.push(obj);
        }
        
        const updatedItem = items.find(item => item.$primaryKey === waitingForExpiration.itemId);
        if (updatedItem && updatedItem.daysUntilExpiration !== waitingForExpiration.originalDaysUntilExpiration) {
          // Update the objects list
          setObjects(items);
          
          // Update selected item if it's the one we're waiting for
          if (selectedItem && selectedItem.$primaryKey === waitingForExpiration.itemId) {
            setSelectedItem(updatedItem);
          }
          
          // Clear the waiting states
          setWaitingForExpiration(null);
          setRefreshingItemId(null);
        }
      }, 1000); // Poll every second

      return () => clearInterval(interval);
    }
  }, [waitingForExpiration, selectedItem]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const filterDropdown = document.querySelector(`.${css.filterDropdown}`);
      if (filterDropdown && !filterDropdown.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  const handleEditClick = (item: Osdk.Instance<FridgeItem>) => {
    setEditingItem(item);
    setEditForm({
      name: item.name || "",
      quantity: item.quantity || 0,
      useBy: item.useBy || "",
      noUseBy: !item.useBy,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    setIsSaving(true);
    try {
      const result = await client(editItem).applyAction(
        {
          fridge_item: editingItem,
          name: editForm.name,
          quantity: editForm.quantity,
          use_by: editForm.noUseBy ? undefined : (editForm.useBy || undefined),
          date_added: editingItem.dateAdded,
        },
        {
          $returnEdits: true,
        }
      );

      if (result.type === "edits") {
        setRefreshingItemId(editingItem.$primaryKey);
        
        // If useBy was changed and is not empty or null, wait for expiration update
        if (editForm.useBy !== editingItem.useBy && !editForm.noUseBy && editForm.useBy) {
          setWaitingForExpiration({
            itemId: editingItem.$primaryKey,
            originalDaysUntilExpiration: editingItem.daysUntilExpiration
          });
        } else {
          // If useBy wasn't changed or was cleared, just do normal refresh
          const items: Osdk.Instance<FridgeItem>[] = [];
          for await (const obj of client(FridgeItem).asyncIter()) {
            items.push(obj);
          }
          setObjects(items);
          
          setTimeout(() => setRefreshingItemId(null), 500);
        }
        
        // Close both modals
        setEditingItem(null);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to edit item:', error);
      setRefreshingItemId(null);
      setWaitingForExpiration(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setAddForm({
      name: "",
      quantity: 0,
      useBy: "",
      noUseBy: false,
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const result = await client(addItem).applyAction(
        {
          id: crypto.randomUUID(),
          name: addForm.name,
          quantity: addForm.quantity,
          use_by: addForm.noUseBy ? undefined : (addForm.useBy || undefined),
        },
        {
          $returnEdits: true,
        }
      );

      if (result.type === "edits") {
        // Get initial items list
        const items: Osdk.Instance<FridgeItem>[] = [];
        for await (const obj of client(FridgeItem).asyncIter()) {
          items.push(obj);
        }
        
        // Find the newly added item
        const newItem = items.find(item => item.name === addForm.name);
        if (newItem) {
          setRefreshingItemId(newItem.$primaryKey);
          if (!addForm.noUseBy && addForm.useBy) {
            setWaitingForExpiration({
              itemId: newItem.$primaryKey,
              originalDaysUntilExpiration: undefined
            });
          } else {
            // If no useBy date, just wait for dateAdded
            const interval = setInterval(async () => {
              const updatedItems: Osdk.Instance<FridgeItem>[] = [];
              for await (const obj of client(FridgeItem).asyncIter()) {
                updatedItems.push(obj);
              }
              const updatedItem = updatedItems.find(item => item.$primaryKey === newItem.$primaryKey);
              if (updatedItem && updatedItem.dateAdded) {
                setObjects(updatedItems);
                setRefreshingItemId(null);
                clearInterval(interval);
              }
            }, 1000);
            // Clear interval after 10 seconds to prevent infinite polling
            setTimeout(() => clearInterval(interval), 10000);
          }
        }
        
        setObjects(items);
        setIsAdding(false);
      }
    } catch (error) {
      console.error('Failed to add item:', error);
      setRefreshingItemId(null);
      setWaitingForExpiration(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, item: Osdk.Instance<FridgeItem>) => {
    e.stopPropagation();

    // Show confirmation dialog
    if (!window.confirm('Are you sure you want to delete this item?')) {
      return;
    }

    setIsSaving(true);

    try {
      const result = await client(deleteItem).applyAction(
        {
          FridgeItem: item,
        },
        {
          $returnEdits: true,
        }
      );

      if (result.type === "edits") {
        const items: Osdk.Instance<FridgeItem>[] = [];
        for await (const obj of client(FridgeItem).asyncIter()) {
          items.push(obj);
        }
        setObjects(items);
        setSelectedItem(null);
      }
    } catch (error) {
      console.error('Failed to delete item:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const getExpiryClass = (daysUntilExpiration: number | undefined) => {
    if (daysUntilExpiration === undefined) return 'good';
    if (daysUntilExpiration < 0) return 'expired';
    if (daysUntilExpiration <= 2) return 'nearExpiry';
    return 'good';
  };

  const getExpiryPriority = (daysUntilExpiration: number | undefined) => {
    if (daysUntilExpiration === undefined) return 3;
    if (daysUntilExpiration < 0) return 1;
    if (daysUntilExpiration <= 2) return 2;
    return 3;
  };

  const toggleFilter = (filter: string) => {
    const newFilters = new Set(expiryFilters);
    if (filter === 'all') {
      newFilters.clear();
      newFilters.add('all');
    } else {
      newFilters.delete('all');
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
        if (newFilters.size === 0) {
          newFilters.add('all');
        }
      } else {
        newFilters.add(filter);
      }
    }
    setExpiryFilters(newFilters);
  };

  const sortedAndFilteredItems = objects
    .filter(item => item.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    .filter(item => {
      if (expiryFilters.has('all')) return true;
      
      const conditions = {
        expired: item.daysUntilExpiration !== undefined && item.daysUntilExpiration < 0,
        nearExpiry: item.daysUntilExpiration !== undefined && item.daysUntilExpiration >= 0 && item.daysUntilExpiration <= 2,
        good: item.daysUntilExpiration === undefined || item.daysUntilExpiration > 2
      };

      return Array.from(expiryFilters).some(filter => conditions[filter as keyof typeof conditions]);
    })
    .sort((a, b) => {
      // First sort by expiry priority
      const priorityA = getExpiryPriority(a.daysUntilExpiration);
      const priorityB = getExpiryPriority(b.daysUntilExpiration);
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }

      // Then sort by daysUntilExpiration within the same priority
      if (a.daysUntilExpiration !== b.daysUntilExpiration) {
        return (a.daysUntilExpiration ?? Infinity) - (b.daysUntilExpiration ?? Infinity);
      }

      // Finally sort by name
      return (a.name ?? '').localeCompare(b.name ?? '');
    });

  const renderField = (label: string, value: any) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (label === "Quantity" && value === 0) {
      return null;
    }
    if (typeof value === 'boolean') {
      return <p>{label}: {value ? 'Yes' : 'No'}</p>;
    }
    return <p>{label}: {value}</p>;
  };

  const handleBulkDelete = async () => {
    // Show confirmation dialog
    if (!window.confirm(`Are you sure you want to delete ${selectedItems.size} item${selectedItems.size > 1 ? 's' : ''}?`)) {
      return;
    }

    setIsSaving(true);
    try {
      // Delete items one by one
      for (const itemId of selectedItems) {
        const item = objects.find(obj => obj.$primaryKey === itemId);
        if (item) {
          await client(deleteItem).applyAction(
            {
              FridgeItem: item,
            },
            {
              $returnEdits: true,
            }
          );
        }
      }

      // Refresh the list
      const newItems: Osdk.Instance<FridgeItem>[] = [];
      for await (const obj of client(FridgeItem).asyncIter()) {
        newItems.push(obj);
      }
      setObjects(newItems);
      setSelectedItems(new Set());
      setIsSelecting(false);
    } catch (error) {
      console.error('Failed to delete items:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleItemSelection = (e: React.MouseEvent | React.ChangeEvent, itemId: string) => {
    e.stopPropagation();
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const renderItemCard = (item: Osdk.Instance<FridgeItem>, isModal: boolean = false) => (
    <div className={css.itemCardContent}>
      {refreshingItemId === item.$primaryKey && (
        <div className={css.cardOverlay}>
          <div className={css.cardSpinner}></div>
        </div>
      )}
      <div className={css.itemHeader}>
        <div className={css.itemHeaderLeft}>
          {isSelecting && !isModal && (
            <input
              type="checkbox"
              checked={selectedItems.has(item.$primaryKey)}
              onChange={(e) => toggleItemSelection(e, item.$primaryKey)}
              onClick={(e) => e.stopPropagation()}
              className={css.selectCheckbox}
            />
          )}
          {item.name && (
            <h3 className={css[getExpiryClass(item.daysUntilExpiration)]}>
              {item.name}
            </h3>
          )}
        </div>
        {isModal && (
          <div className={css.buttonGroup}>
            <button 
              className={css.editButton}
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick(item);
              }}
              disabled={isSaving}
            >
              Edit
            </button>
            <button 
              className={css.deleteButton}
              onClick={(e) => handleDeleteClick(e, item)}
              disabled={isSaving}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {renderField("Date Added", item.dateAdded)}
      {renderField("Quantity", item.quantity)}
      {renderField("Use By", item.useBy)}
      {renderField("Days until Expiration", item.daysUntilExpiration)}
      {renderField("Out of Date", item.outOfDate)}
    </div>
  );

  const handleSelectAll = () => {
    const newSelection = new Set(sortedAndFilteredItems.map(item => item.$primaryKey));
    setSelectedItems(newSelection);
  };

  const handleDeselectAll = () => {
    setSelectedItems(new Set());
  };

  return (
    <div className={css.dashboardContainer}>
      <div className={css.dashboardHeader}>
        <h1>My Fridge Items 🥬</h1>
        <div className={css.headerButtons}>
          <button
            className={`${css.selectButton} ${isSelecting ? css.active : ''}`}
            onClick={() => {
              setIsSelecting(!isSelecting);
              setSelectedItems(new Set());
            }}
          >
            {isSelecting ? "Cancel Selection" : "Select"}
          </button>
          {!isSelecting && (
            <button className={css.addButton} onClick={handleAddClick}>
              Add Item
            </button>
          )}
          {isSelecting && (
            <>
              <button
                className={css.selectAllButton}
                onClick={selectedItems.size === sortedAndFilteredItems.length ? handleDeselectAll : handleSelectAll}
              >
                {selectedItems.size === sortedAndFilteredItems.length ? 'Deselect All' : 'Select All'}
              </button>
              <button
                className={css.bulkDeleteButton}
                onClick={handleBulkDelete}
                disabled={selectedItems.size === 0 || isSaving}
              >
                {isSaving ? "Deleting..." : `Delete (${selectedItems.size})`}
              </button>
            </>
          )}
        </div>
      </div>
      <div className={css.searchContainer}>
        <div className={css.searchRow}>
          <input
            type="text"
            placeholder="Search items..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={css.searchInput}
          />
          <div className={css.filterDropdown}>
            <button 
              className={css.filterButton} 
              onClick={(e) => {
                e.stopPropagation();
                setIsFilterOpen(!isFilterOpen);
              }}
            >
              Filter 
            </button>
            {isFilterOpen && (
              <div className={css.filterMenu} onClick={e => e.stopPropagation()}>
                <label className={css.filterOption}>
                  <input
                    type="checkbox"
                    checked={expiryFilters.has('all')}
                    onChange={() => toggleFilter('all')}
                  />
                  All Items
                </label>
                <label className={css.filterOption}>
                  <input
                    type="checkbox"
                    checked={expiryFilters.has('expired')}
                    onChange={() => toggleFilter('expired')}
                  />
                  Expired
                </label>
                <label className={css.filterOption}>
                  <input
                    type="checkbox"
                    checked={expiryFilters.has('nearExpiry')}
                    onChange={() => toggleFilter('nearExpiry')}
                  />
                  Near Expiry
                </label>
                <label className={css.filterOption}>
                  <input
                    type="checkbox"
                    checked={expiryFilters.has('good')}
                    onChange={() => toggleFilter('good')}
                  />
                  Good
                </label>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className={css.dashboard}>
        {sortedAndFilteredItems.length === 0 ? (
          <p>No items found...</p>
        ) : (
          <div className={css.itemsGrid}>
            {sortedAndFilteredItems.map((item) => (
              <div
                key={item.$primaryKey}
                className={`${css.itemCard} ${isSelecting && selectedItems.has(item.$primaryKey) ? css.selected : ''}`}
                onClick={() => {
                  if (isSelecting) {
                    toggleItemSelection({ stopPropagation: () => {} } as React.MouseEvent, item.$primaryKey);
                  } else {
                    setSelectedItem(item);
                  }
                }}
              >
                {renderItemCard(item)}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedItem && (
        <div className={css.modalOverlay} onClick={() => setSelectedItem(null)}>
          <div className={css.modalContent} onClick={e => e.stopPropagation()}>
            {renderItemCard(selectedItem, true)}
          </div>
        </div>
      )}

      {editingItem && (
        <div className={css.modalOverlay} onClick={() => !isSaving && setEditingItem(null)}>
          <div className={css.editFormModal} onClick={e => e.stopPropagation()}>
            <h3>Edit Item</h3>
            <form onSubmit={handleEditSubmit}>
              <div className={css.formField}>
                <label>Name:</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={e => setEditForm({...editForm, name: e.target.value})}
                  disabled={isSaving}
                />
              </div>
              <div className={css.formField}>
                <label>Quantity:</label>
                <input
                  type="number"
                  value={editForm.quantity}
                  onChange={e => setEditForm({...editForm, quantity: parseInt(e.target.value)})}
                  disabled={isSaving}
                />
              </div>
              <div className={css.formField}>
                <label>Use By:</label>
                <div className={css.useByGroup}>
                  <input
                    type="date"
                    value={editForm.useBy}
                    onChange={e => setEditForm({...editForm, useBy: e.target.value})}
                    onFocus={e => e.target.showPicker()}
                    disabled={isSaving || editForm.noUseBy}
                  />
                  <label className={css.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={editForm.noUseBy}
                      onChange={e => setEditForm({
                        ...editForm,
                        noUseBy: e.target.checked,
                        useBy: e.target.checked ? "" : editForm.useBy
                      })}
                      disabled={isSaving}
                    />
                    No expiry date
                  </label>
                </div>
              </div>
              <div className={css.formButtons}>
                <button 
                  type="submit" 
                  className={`${css.saveButton} ${isSaving ? css.saving : ''}`}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className={css.spinner}></div>
                      Saving...
                    </>
                  ) : 'Save'}
                </button>
                <button 
                  type="button" 
                  className={css.cancelButton} 
                  onClick={() => setEditingItem(null)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isAdding && (
        <div className={css.modalOverlay} onClick={() => !isSaving && setIsAdding(false)}>
          <div className={css.editFormModal} onClick={e => e.stopPropagation()}>
            <h3>Add New Item</h3>
            <form onSubmit={handleAddSubmit}>
              <div className={css.formField}>
                <label>Name:</label>
                <input
                  type="text"
                  value={addForm.name}
                  onChange={e => setAddForm({...addForm, name: e.target.value})}
                  disabled={isSaving}
                  required
                />
              </div>
              <div className={css.formField}>
                <label>Quantity:</label>
                <input
                  type="number"
                  value={addForm.quantity}
                  onChange={e => setAddForm({...addForm, quantity: parseInt(e.target.value)})}
                  disabled={isSaving}
                />
              </div>
              <div className={css.formField}>
                <label>Use By:</label>
                <div className={css.useByGroup}>
                  <input
                    type="date"
                    value={addForm.useBy}
                    onChange={e => setAddForm({...addForm, useBy: e.target.value})}
                    onFocus={e => e.target.showPicker()}
                    disabled={isSaving || addForm.noUseBy}
                  />
                  <label className={css.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={addForm.noUseBy}
                      onChange={e => setAddForm({
                        ...addForm,
                        noUseBy: e.target.checked,
                        useBy: e.target.checked ? "" : addForm.useBy
                      })}
                      disabled={isSaving}
                    />
                    No expiry date
                  </label>
                </div>
              </div>
              <div className={css.formButtons}>
                <button 
                  type="submit" 
                  className={`${css.saveButton} ${isSaving ? css.saving : ''}`}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <>
                      <div className={css.spinner}></div>
                      Saving...
                    </>
                  ) : 'Add'}
                </button>
                <button 
                  type="button" 
                  className={css.cancelButton} 
                  onClick={() => setIsAdding(false)}
                  disabled={isSaving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
