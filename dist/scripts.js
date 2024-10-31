// index

// footer nav
document.addEventListener('DOMContentLoaded', function() {
                    const navItems = document.querySelectorAll('#navbar ul li a');
                    const quickLinksCol1 = document.getElementById('quick-links-col1');
                    const quickLinksCol2 = document.getElementById('quick-links-col2');
            
                    navItems.forEach((item, index) => {
                        const listItem = document.createElement('li');
                        const link = document.createElement('a');
                        link.href = item.href;
                        link.textContent = item.textContent;
                        link.classList.add('hover:underline');
                        listItem.appendChild(link);
            
                        if (index % 2 === 0) {
                            quickLinksCol1.appendChild(listItem);
                        } else {
                            quickLinksCol2.appendChild(listItem);
                        }
                    });
                });
