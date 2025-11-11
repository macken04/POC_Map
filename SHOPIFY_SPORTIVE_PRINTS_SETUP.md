# Shopify Sportive Prints Section Setup Guide

This guide will walk you through setting up the new "Sportive Prints Grid" section on your Shopify store.

## Step 1: Upload the New Section File

The file `sportive-prints-grid.liquid` has been created in your theme directory at `shopify-theme/dawn/sections/`.

If you are developing locally using the Shopify CLI, this file is already in the right place. If you are working with a downloaded theme, you will need to upload this file to your theme's `sections` directory.

## Step 2: Create a Product Collection

1.  In your Shopify Admin, navigate to **Products** > **Collections**.
2.  Click **Create collection**.
3.  Enter a **Title** for the collection, for example, "Sportive Prints".
4.  You can leave the collection type as "Manual" and click **Save**.
5.  In the **Products** section of the collection page, add all the sportive print products you want to display.

## Step 3: Create a New Page

1.  In your Shopify Admin, go to **Online Store** > **Pages**.
2.  Click **Add page**.
3.  Give your page a **Title**, such as "Our Sportive Prints" or "Custom Prints".
4.  You can leave the content section blank.
5.  Under **Theme template** on the bottom right, leave it as the `Default page`.
6.  Click **Save**.

## Step 4: Add and Configure the Section

1.  Go to **Online Store** > **Themes**.
2.  Find your "Dawn" theme (or your active theme) and click **Customize**.
3.  From the dropdown menu at the top center of the screen, select **Pages** and then click on the page you just created (e.g., "Our Sportive Prints").
4.  On the left-hand sidebar, under "Page", click **Add section**.
5.  From the list of available sections, choose **Sportive Prints Grid**.
6.  Click on the newly added "Sportive Prints Grid" section to open its settings.
7.  In the settings panel on the right:
    *   Click the **Select collection** button and choose the "Sportive Prints" collection you created in Step 2.
    *   You can also customize the **Title** and the number of **Products to show**.
8.  Click **Save** in the top right corner of the Theme Customizer.

## Step 5: Add the Page to Your Website's Navigation

1.  Go to **Online Store** > **Navigation**.
2.  Click on the menu you want to add the page to (e.g., **Main menu**).
3.  Click **Add menu item**.
4.  In the **Name** field, enter the link title, for example, "Prints".
5.  Click in the **Link** field, select **Pages**, and then choose the page you created ("Our Sportive Prints").
6.  Click **Add**, and then **Save menu**.

Your new section is now live. You can visit the page on your storefront to see your grid of sportive prints.
