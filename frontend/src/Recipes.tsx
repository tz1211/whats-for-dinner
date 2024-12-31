import { useState, useEffect } from "react";
import { Recipe, createRecipe, editRecipe, deleteRecipe } from "@whatsfordinner/sdk"; 
import { Osdk } from "@osdk/client";
import css from "./Recipes.module.css";
import client from "./client";

const ITEMS_PER_PAGE = 6;

function Recipes() {
  const [recipes, setRecipes] = useState<Osdk.Instance<Recipe>[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRecipe, setSelectedRecipe] = useState<Osdk.Instance<Recipe> | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Osdk.Instance<Recipe> | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<'ingredients' | 'procedure'>('ingredients');

  const [addForm, setAddForm] = useState({
    name: "",
    link: "",
    ingredients: "",
    procedure: "",
  });

  const [editForm, setEditForm] = useState({
    name: "",
    link: "",
    ingredients: "",
    procedure: "",
  });

  useEffect(() => {
    async function fetchRecipes() {
      const items: Osdk.Instance<Recipe>[] = [];
      for await (const obj of client(Recipe).asyncIter()) {
        items.push(obj);
      }
      setRecipes(items);
    }
    fetchRecipes();
  }, []);

  const handleEditClick = (recipe: Osdk.Instance<Recipe>) => {
    let parsedIngredients = recipe.ingredients || "";
    try {
      // Parse the JSON string and join with newlines for editing
      const ingredientsArray = JSON.parse(recipe.ingredients || "[]");
      if (Array.isArray(ingredientsArray)) {
        parsedIngredients = ingredientsArray.join('\n');
      }
    } catch (e) {
      console.error('Failed to parse ingredients:', e);
    }

    setEditingRecipe(recipe);
    setEditForm({
      name: recipe.name || "",
      link: recipe.link_ || "",
      ingredients: parsedIngredients,
      procedure: recipe.procedure || "",
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecipe) return;

    // Convert ingredients to array format
    const ingredientsArray = editForm.ingredients
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    setIsSaving(true);
    try {
      const result = await client(editRecipe).applyAction(
        {
          Recipe: editingRecipe,
          name: editForm.name,
          link_: editForm.link || undefined,
          ingredients: JSON.stringify(ingredientsArray),
          procedure: editForm.procedure,
        },
        {
          $returnEdits: true,
        }
      );

      if (result.type === "edits") {
        const items: Osdk.Instance<Recipe>[] = [];
        for await (const obj of client(Recipe).asyncIter()) {
          items.push(obj);
        }
        setRecipes(items);
        setEditingRecipe(null);
        setSelectedRecipe(null);
      }
    } catch (error) {
      console.error('Failed to edit recipe:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddClick = () => {
    setIsAdding(true);
    setAddForm({
      name: "",
      link: "",
      ingredients: "",
      procedure: "",
    });
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    // Convert ingredients to array format
    const ingredientsArray = addForm.ingredients
      .split('\n')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    try {
      const result = await client(createRecipe).applyAction(
        {
          name: addForm.name,
          link_: addForm.link || undefined,
          ingredients: JSON.stringify(ingredientsArray),
          procedure: addForm.procedure,
        },
        {
          $returnEdits: true,
        }
      );

      if (result.type === "edits") {
        const items: Osdk.Instance<Recipe>[] = [];
        for await (const obj of client(Recipe).asyncIter()) {
          items.push(obj);
        }
        setRecipes(items);
        setIsAdding(false);
      }
    } catch (error) {
      console.error('Failed to add recipe:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = async (e: React.MouseEvent, recipe: Osdk.Instance<Recipe>) => {
    e.stopPropagation();
    setIsSaving(true);

    try {
      const result = await client(deleteRecipe).applyAction(
        {
          Recipe: recipe,
        },
        {
          $returnEdits: true,
        }
      );

      if (result.type === "edits") {
        const items: Osdk.Instance<Recipe>[] = [];
        for await (const obj of client(Recipe).asyncIter()) {
          items.push(obj);
        }
        setRecipes(items);
        setSelectedRecipe(null);
      }
    } catch (error) {
      console.error('Failed to delete recipe:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderField = (label: string, value: any, isInModal: boolean = false) => {
    if (value === undefined || value === null || value === '') {
      return null;
    }
    if (label === "Link") {
      return (
        <p>
          {label}: <a href={value} target="_blank" rel="noopener noreferrer" className={css.link}>{value}</a>
        </p>
      );
    }
    if (label === "Ingredients") {
      try {
        const ingredients = JSON.parse(value);
        if (Array.isArray(ingredients)) {
          return (
            <div>
              {!isInModal && <p className={css.fieldLabel}>{label}:</p>}
              <ul className={css.ingredientsList}>
                {ingredients.map((ingredient, index) => (
                  <li key={index}>{ingredient}</li>
                ))}
              </ul>
            </div>
          );
        }
      } catch (e) {
        return <p>{isInModal ? value : `${label}: ${value}`}</p>;
      }
    }
    return <p>{isInModal ? value : `${label}: ${value}`}</p>;
  };

  const renderRecipeCard = (recipe: Osdk.Instance<Recipe>, isModal: boolean = false) => (
    <div className={css.recipeCardContent}>
      <div className={css.recipeHeader}>
        <div className={css.recipeHeaderLeft}>
          {recipe.name && (
            <h3>{recipe.name}</h3>
          )}
        </div>
        {isModal && (
          <div className={css.buttonGroup}>
            <button 
              className={css.editButton}
              onClick={(e) => {
                e.stopPropagation();
                handleEditClick(recipe);
              }}
              disabled={isSaving}
            >
              Edit
            </button>
            <button 
              className={css.deleteButton}
              onClick={(e) => handleDeleteClick(e, recipe)}
              disabled={isSaving}
            >
              Delete
            </button>
          </div>
        )}
      </div>
      {recipe.link_ && renderField("Link", recipe.link_)}
      {recipe.cleanedIngredients && renderField("Ingredients", recipe.cleanedIngredients)}
      {isModal && recipe.procedure && renderField("Procedure", recipe.procedure)}
    </div>
  );

  const filteredRecipes = recipes
    .filter(recipe => recipe.name?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false)
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''));

  const totalPages = Math.ceil(filteredRecipes.length / ITEMS_PER_PAGE);
  const paginatedRecipes = filteredRecipes.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo(0, 0);
  };

  // Reset to first page when search query changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const renderRecipeModal = (recipe: Osdk.Instance<Recipe>) => (
    <div className={css.modalContent} onClick={e => e.stopPropagation()}>
      <div className={css.recipeHeader}>
        <div className={css.recipeHeaderLeft}>
          <h3>{recipe.name}</h3>
          {recipe.link_ && (
            <a href={recipe.link_} target="_blank" rel="noopener noreferrer" className={css.link}>
              View Recipe Link
            </a>
          )}
        </div>
        <div className={css.buttonGroup}>
          <button 
            className={css.editButton}
            onClick={(e) => {
              e.stopPropagation();
              handleEditClick(recipe);
            }}
            disabled={isSaving}
          >
            Edit
          </button>
          <button 
            className={css.deleteButton}
            onClick={(e) => handleDeleteClick(e, recipe)}
            disabled={isSaving}
          >
            Delete
          </button>
        </div>
      </div>

      <div className={css.tabs}>
        <button
          className={`${css.tab} ${activeTab === 'ingredients' ? css.activeTab : ''}`}
          onClick={() => setActiveTab('ingredients')}
        >
          Ingredients
        </button>
        <button
          className={`${css.tab} ${activeTab === 'procedure' ? css.activeTab : ''}`}
          onClick={() => setActiveTab('procedure')}
        >
          Procedure
        </button>
      </div>

      <div className={css.tabContent}>
        {activeTab === 'ingredients' && (
          <div>
            <ul className={css.modalIngredientsList}>
              {recipe.cleanedIngredients && recipe.cleanedIngredients
                .replace(/[\[\]"]/g, '')
                .split(',')
                .map((ingredient, index) => (
                  <li key={index}>{ingredient.trim().replace(/'/g, '')}</li>
                ))}
            </ul>
          </div>
        )}
        {activeTab === 'procedure' && (
          <div>
            <ol className={css.modalProcedureList}>
              {recipe.procedure && recipe.procedure
                .split("',")
                .map((step, index) => (
                  <li key={index}>{step.trim().replace(/'/g, '').replace(/[\[\]"']/g, '')}</li>
                ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className={css.dashboardContainer}>
      <div className={css.dashboardHeader}>
        <h1>My Recipes 📖</h1>
        <div className={css.headerButtons}>
          <button className={css.addButton} onClick={handleAddClick}>
            Add Recipe
          </button>
        </div>
      </div>
      <div className={css.searchContainer}>
        <div className={css.searchRow}>
          <input
            type="text"
            placeholder="Search recipes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={css.searchInput}
          />
        </div>
      </div>
      <div className={css.dashboard}>
        {filteredRecipes.length === 0 ? (
          <p>No recipes found...</p>
        ) : (
          <>
            <div className={css.recipesGrid}>
              {paginatedRecipes.map((recipe) => (
                <div
                  key={recipe.$primaryKey}
                  className={css.recipeCard}
                  onClick={() => setSelectedRecipe(recipe)}
                >
                  {renderRecipeCard(recipe)}
                </div>
              ))}
            </div>
            {totalPages > 1 && (
              <div className={css.pagination}>
                <button
                  className={css.pageButton}
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className={css.pageInfo}>
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className={css.pageButton}
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedRecipe && (
        <div className={css.modalOverlay} onClick={() => setSelectedRecipe(null)}>
          {renderRecipeModal(selectedRecipe)}
        </div>
      )}

      {editingRecipe && (
        <div className={css.modalOverlay} onClick={() => !isSaving && setEditingRecipe(null)}>
          <div className={css.editFormModal} onClick={e => e.stopPropagation()}>
            <h3>Edit Recipe</h3>
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
                <label>Link (optional):</label>
                <input
                  type="text"
                  value={editForm.link}
                  onChange={e => setEditForm({...editForm, link: e.target.value})}
                  disabled={isSaving}
                />
              </div>
              <div className={css.formField}>
                <label>Ingredients (one per line):</label>
                <textarea
                  value={editForm.ingredients}
                  onChange={e => setEditForm({...editForm, ingredients: e.target.value})}
                  disabled={isSaving}
                  className={css.textarea}
                  required
                  placeholder="Enter each ingredient on a new line:&#10;2 cups flour&#10;1 tsp salt&#10;1 cup sugar"
                />
              </div>
              <div className={css.formField}>
                <label>Procedure:</label>
                <textarea
                  value={editForm.procedure}
                  onChange={e => setEditForm({...editForm, procedure: e.target.value})}
                  disabled={isSaving}
                  className={css.textarea}
                />
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
                  onClick={() => setEditingRecipe(null)}
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
            <h3>Add New Recipe</h3>
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
                <label>Link (optional):</label>
                <input
                  type="text"
                  value={addForm.link}
                  onChange={e => setAddForm({...addForm, link: e.target.value})}
                  disabled={isSaving}
                />
              </div>
              <div className={css.formField}>
                <label>Ingredients (one per line):</label>
                <textarea
                  value={addForm.ingredients}
                  onChange={e => setAddForm({...addForm, ingredients: e.target.value})}
                  disabled={isSaving}
                  className={css.textarea}
                  required
                  placeholder="Enter each ingredient on a new line:&#10;2 cups flour&#10;1 tsp salt&#10;1 cup sugar"
                />
              </div>
              <div className={css.formField}>
                <label>Procedure:</label>
                <textarea
                  value={addForm.procedure}
                  onChange={e => setAddForm({...addForm, procedure: e.target.value})}
                  disabled={isSaving}
                  className={css.textarea}
                  required
                />
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

export default Recipes; 