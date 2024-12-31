import os
import json 
import requests 
import pandas as pd 
from tqdm import tqdm
from bs4 import BeautifulSoup

### Get recipe links ###

def get_recipe_links(page_num):
    """
    Retrieves recipe links from a specific page on BBC Good Food website.

    Args:
        page_num (int): The page number to scrape recipe links from.

    Returns:
        list: A list of recipe URLs found on the specified page. Each URL is a full path
              starting with 'https://www.bbcgoodfood.com'. Returns an empty list if the
              page request fails.

    Example:
        >>> links = get_recipe_links(1)
        >>> print(links[0])
        'https://www.bbcgoodfood.com/recipes/classic-lasagne'
    """
    page_url = f"https://www.bbcgoodfood.com/recipes/page/{page_num}"
    response = requests.get(page_url)

    recipe_links = []
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, "html.parser")
        recipe_links = []
        for article in soup.find_all("article", class_="card text-align-left card--with-borders"): 
            divs = article.find_all("div", class_="card__section")
            if len(divs) == 3:
                link = divs[1].find("a")
                if link and "href" in link.attrs:
                    recipe_links.append(link["href"])
        recipe_links = [os.path.join("https://www.bbcgoodfood.com", link.lstrip('/')) for link in recipe_links]

    return recipe_links 

def get_all_recipe_links(page_num_start, page_num_end):
    """
    Retrieves all recipe links from BBC Good Food website by iterating through all pages.

    Returns:
        list: A list containing all recipe URLs found across all pages. Each URL is a full path
              starting with 'https://www.bbcgoodfood.com'.

    Example:
        >>> links = get_all_recipe_links()
        >>> print(len(links))
        1000
        >>> print(links[0])
        'https://www.bbcgoodfood.com/recipes/classic-lasagne'
    """
    all_recipe_links = []
    for page_num in tqdm(range(page_num_start, page_num_end)):
        recipe_links = get_recipe_links(page_num)
        all_recipe_links.extend(recipe_links)

    return all_recipe_links

# all_recipe_links = get_all_recipe_links(1, 335)

# Export recipe links to CSV
# # Convert list to DataFrame with proper structure
# df = pd.DataFrame({'recipe_url': all_recipe_links})
# df.to_csv('../data/recipe_links.csv', index=False, header=False)

### Get recipe details ###
def get_recipe_details(recipe_url):
    response = requests.get(recipe_url)
    ingredients = []
    procedure = []
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, "html.parser")
        
        # parse ingredients
        ingredients_list = soup.find_all("li", class_="ingredients-list__item") 
        for ingredient in ingredients_list:
            ingredients.append(ingredient.text.strip()) 
        
        # parse method 
        method_list = soup.find_all("li", class_="method-steps__list-item") 
        for method in method_list: 
            if method.find("p"): 
                step_desc = method.find("p").text.strip()
                procedure.append(step_desc)
        return {"link": recipe_url, "ingredients": ingredients, "procedure": procedure}



if __name__ == "__main__":
    with open("../data/recipe_links.csv", "r") as f:
        recipe_links = f.read().splitlines() 
    
    with open(f'../data/recipes.jsonl', 'w') as f:
        for recipe_link in tqdm(recipe_links):
            try: 
                recipe = get_recipe_details(recipe_link)
            except Exception as e: 
                print(recipe_link)
                print(e)
                break 
            recipe['url'] = recipe_link
            f.write(json.dumps(recipe) + '\n')
