// Everyday foods with friendly names, pointing at exact USDA entries. They
// rank above the raw USDA list, whose names ("Chicken, broiler or fryers,
// breast, skinless...") don't match how people search.

export interface CommonFood {
  name: string
  usda: number
  /** Extra search words. */
  aka?: string
  /** Default portion: first USDA portion whose label contains this text... */
  portion?: string
  /** ...or a portion of our own [label, grams]. */
  custom?: [string, number]
}

export const COMMON_FOODS: CommonFood[] = [
  // Meat, fish, eggs
  { name: 'Chicken breast, grilled', usda: 171534, portion: '3 oz', aka: 'chicken' },
  { name: 'Chicken thigh, roasted', usda: 172388, portion: 'thigh', aka: 'chicken' },
  { name: 'Chicken tenders', usda: 173321, aka: 'nuggets strips fast food' },
  { name: 'Egg, large', usda: 171287, portion: '1 large', aka: 'eggs' },
  { name: 'Eggs, scrambled', usda: 172187, portion: '1 large', aka: 'egg' },
  { name: 'Egg, hard-boiled', usda: 173424, custom: ['1 large egg', 50], aka: 'eggs boiled' },
  { name: 'Egg whites', usda: 172183, portion: '1 large', aka: 'egg white' },
  { name: 'Ground beef, 93% lean, cooked', usda: 174755, portion: '3 oz', aka: 'hamburger beef' },
  { name: 'Burger patty, 85% lean', usda: 174032, portion: 'patty', aka: 'hamburger beef' },
  { name: 'Steak, sirloin', usda: 173118, portion: '3 oz', aka: 'beef' },
  { name: 'Ground turkey, 93% lean', usda: 172851, portion: '3 oz', aka: 'turkey' },
  { name: 'Pork tenderloin', usda: 168250, portion: '3 oz', aka: 'pork' },
  { name: 'Salmon, cooked', usda: 175168, portion: '3 oz', aka: 'fish' },
  { name: 'Tuna, canned in water', usda: 173709, portion: '3 oz', aka: 'fish' },
  { name: 'Tilapia, cooked', usda: 175177, aka: 'fish' },
  { name: 'Shrimp, cooked', usda: 175180, portion: '3 oz', aka: 'seafood' },
  { name: 'Turkey, deli sliced', usda: 172941, portion: 'slice', aka: 'lunch meat lunchmeat' },
  { name: 'Ham, deli sliced', usda: 173864, portion: 'slice', aka: 'lunch meat lunchmeat' },
  { name: 'Bacon', usda: 167914, portion: '1 slice' },
  { name: 'Turkey bacon', usda: 171639, portion: 'slice', aka: 'bacon' },
  { name: 'Beef jerky', usda: 167536, portion: '1 oz', aka: 'jerky' },
  { name: 'Hot dog, beef', usda: 174614, portion: 'frankfurter', aka: 'hotdog frank' },
  { name: 'Whey protein powder', usda: 173167, aka: 'protein shake scoop' },

  // Dairy
  { name: 'Greek yogurt, plain nonfat', usda: 170894, portion: 'container', aka: 'yogurt' },
  { name: 'Greek yogurt, plain whole milk', usda: 171304, custom: ['1 container (170 g)', 170], aka: 'yogurt' },
  { name: 'Cottage cheese, 2%', usda: 172182, aka: 'cheese' },
  { name: 'Milk, 2%', usda: 171267, portion: '1 cup' },
  { name: 'Milk, skim', usda: 171269, portion: '1 cup', aka: 'nonfat fat free' },
  { name: 'Milk, whole', usda: 171265, portion: '1 cup' },
  { name: 'Chocolate milk', usda: 170880, portion: '1 cup' },
  { name: 'Cheddar cheese', usda: 173414, custom: ['1 slice (1 oz)', 28], aka: 'cheese' },
  { name: 'Mozzarella / string cheese', usda: 170847, custom: ['1 stick (1 oz)', 28], aka: 'cheese' },
  { name: 'Cream cheese', usda: 173418, portion: 'tbsp' },
  { name: 'Sour cream', usda: 171257, portion: 'tbsp' },
  { name: 'Butter', usda: 173410, portion: 'tbsp' },
  { name: 'Ice cream, vanilla', usda: 167575 },

  // Grains and breakfast
  { name: 'Rice, white, cooked', usda: 168878, portion: '1 cup' },
  { name: 'Rice, brown, cooked', usda: 169704, portion: '1 cup' },
  { name: 'Oatmeal, cooked', usda: 171675, portion: '1 cup', aka: 'oats porridge' },
  { name: 'Oats, dry', usda: 173904, custom: ['½ cup dry', 40], aka: 'oatmeal rolled' },
  { name: 'Pasta, cooked', usda: 169737, aka: 'spaghetti noodles macaroni' },
  { name: 'Bread, whole wheat', usda: 172688, portion: '1 slice', aka: 'toast' },
  { name: 'Bread, white', usda: 174924, portion: '1 slice', aka: 'toast' },
  { name: 'Bagel, plain', usda: 174899, portion: '1 bagel' },
  { name: 'English muffin', usda: 175063, portion: 'muffin' },
  { name: 'Tortilla, flour', usda: 175037, portion: 'tortilla', aka: 'wrap burrito' },
  { name: 'Hamburger or hot dog bun', usda: 172796, portion: 'roll', aka: 'bun' },
  { name: 'Quinoa, cooked', usda: 168917 },
  { name: 'Cheerios', usda: 173884, aka: 'cereal' },
  { name: 'Granola', usda: 172975, aka: 'cereal' },
  { name: 'Pancakes', usda: 167926, portion: 'pancake' },
  { name: 'Waffle, frozen', usda: 175048, portion: 'waffle' },
  { name: 'Pancake syrup', usda: 169578, portion: 'tbsp', aka: 'maple' },

  // Fruit
  { name: 'Banana', usda: 173944, portion: 'medium' },
  { name: 'Apple', usda: 171688, portion: 'medium' },
  { name: 'Orange', usda: 169097, portion: '1 fruit' },
  { name: 'Strawberries', usda: 167762, portion: '1 cup', aka: 'berries' },
  { name: 'Blueberries', usda: 171711, portion: '1 cup', aka: 'berries' },
  { name: 'Grapes', usda: 174683, portion: '1 cup' },
  { name: 'Watermelon', usda: 167765, portion: 'diced', aka: 'melon' },
  { name: 'Pineapple', usda: 169124, portion: 'chunks' },
  { name: 'Peach', usda: 169928, portion: 'medium' },
  { name: 'Pear', usda: 169118, portion: 'medium' },
  { name: 'Avocado', usda: 171705, portion: 'NLEA', aka: 'guacamole' },

  // Vegetables and potatoes
  { name: 'Broccoli, cooked', usda: 169967, portion: 'cup' },
  { name: 'Green beans, cooked', usda: 169141, portion: '1 cup' },
  { name: 'Corn, sweet, cooked', usda: 169999, portion: 'medium', aka: 'corn on the cob' },
  { name: 'Peas, green, cooked', usda: 170017, portion: 'cup' },
  { name: 'Carrots', usda: 170393, portion: 'medium' },
  { name: 'Spinach', usda: 168462, portion: '1 cup' },
  { name: 'Romaine lettuce', usda: 169247, portion: '1 cup', aka: 'salad greens' },
  { name: 'Cucumber', usda: 168409, portion: 'slices' },
  { name: 'Tomato', usda: 170457, custom: ['1 medium', 123], aka: 'tomatoes' },
  { name: 'Bell pepper, red', usda: 170108, portion: 'medium', aka: 'peppers' },
  { name: 'Onion', usda: 170000, custom: ['1 medium', 110] },
  { name: 'Potato, baked', usda: 170093, portion: 'medium', aka: 'potatoes' },
  { name: 'Sweet potato, baked', usda: 168483, portion: 'medium', aka: 'potatoes yam' },
  { name: 'French fries', usda: 170698, portion: 'medium', aka: 'fries fast food' },

  // Beans (Jeremy's dislike list filters these out of suggestions)
  { name: 'Black beans, cooked', usda: 173735, aka: 'beans' },
  { name: 'Hummus', usda: 174289, portion: 'tbsp' },
  { name: 'Edamame', usda: 168411 },

  // Snacks and meals
  { name: 'Peanut butter', usda: 172470, portion: '2 tbsp', aka: 'pb' },
  { name: 'Almonds', usda: 170567, custom: ['1 oz (23 almonds)', 28], aka: 'nuts' },
  { name: 'Granola bar', usda: 167542, portion: 'bar' },
  { name: 'Tortilla chips', usda: 167558, portion: '1 oz', aka: 'chips' },
  { name: 'Potato chips', usda: 169677, portion: '1 oz', aka: 'chips' },
  { name: 'Popcorn', usda: 167959, portion: '1 cup' },
  { name: 'Chocolate chip cookie', usda: 172820, portion: 'medium', aka: 'cookies' },
  { name: 'Mac and cheese', usda: 169770, portion: '1 cup', aka: 'macaroni' },
  { name: 'Pizza, cheese', usda: 170317, aka: 'slice' },
  { name: 'Chicken noodle soup', usda: 172909, aka: 'soup' },
  { name: 'Spaghetti sauce', usda: 171192, aka: 'marinara pasta sauce' },

  // Drinks and condiments
  { name: 'Orange juice', usda: 169100, portion: '1 cup', aka: 'oj' },
  { name: 'Coffee, black', usda: 171890, portion: 'fl oz' },
  { name: 'Honey', usda: 169640, portion: 'tbsp' },
  { name: 'Jam', usda: 169641, portion: 'tbsp', aka: 'jelly preserves' },
  { name: 'Ketchup', usda: 168556, portion: 'tbsp', aka: 'catsup' },
  { name: 'Mayonnaise', usda: 171009, portion: 'tbsp', aka: 'mayo' },
  { name: 'Ranch dressing', usda: 173592, portion: 'tablespoon', aka: 'dressing' },
  { name: 'Olive oil', usda: 171413, portion: 'tablespoon', aka: 'oil' },
]
