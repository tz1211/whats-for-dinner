import json 
import pandas as pd 

if __name__ == "__main__": 
    name, links, ingredients, procedure = [], [], [], []
    with open("../data/recipes.jsonl", "r") as f:
        for line in f:
            recipe = json.loads(line)
            link = recipe['link']
            title = link.split("/")[-1].replace("-", " ").title()
            name.append(title)
            links.append(link)
            ingredients.append(recipe['ingredients'])
            procedure.append(recipe['procedure'])
            
    df = pd.DataFrame({'name': name, 'link': links, 'ingredients': ingredients, 'procedure': procedure})
    df.to_csv("data/recipes.csv", index=False)
